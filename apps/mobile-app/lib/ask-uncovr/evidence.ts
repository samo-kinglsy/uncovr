import { evaluateFeature } from './evaluator.ts';
import {
  classifyAskIntent,
  extractSafeScenarioInputs,
  prepareSuppliedInputs,
} from './intent.ts';

import type {
  AskCardFeature,
  AskEvidenceLink,
  AskEvidencePackage,
  AskEvaluatedFeatureEvidence,
  AskEvaluationInputDefinition,
  AskOverallOutcome,
  AskPreparedInput,
  AskSourceWarning,
  GetAskEvidenceOptions,
  PrepareAskEvidenceOptions,
} from './types.ts';

export async function getAskEvidencePackage(
  options: GetAskEvidenceOptions
): Promise<AskEvidencePackage> {
  const { getAskFeatureData } = await import('./data.ts');
  const featureData = await getAskFeatureData({ userId: options.userId });
  return prepareAskEvidencePackage({ ...options, featureData });
}

export function prepareAskEvidencePackage({
  asOfDate,
  featureData,
  question,
  suppliedInputs = {},
}: PrepareAskEvidenceOptions): AskEvidencePackage {
  const intent = classifyAskIntent(question);
  const cardsWithVerifiedData = new Set(featureData.features.map(({ card }) => card.id));
  const cardsWithoutVerifiedData = featureData.ownedCards.filter(
    ({ id }) => !cardsWithVerifiedData.has(id)
  );

  if (featureData.ownedCards.length === 0) {
    return packageWithoutFeatures('NO_OWNED_CARDS', question, asOfDate, intent, [], 0);
  }
  if (intent.resolution === 'UNRECOGNIZED') {
    return packageWithoutFeatures(
      'INTENT_NOT_RECOGNIZED', question, asOfDate, intent, cardsWithoutVerifiedData,
      featureData.ownedCards.length
    );
  }
  if (intent.resolution === 'AMBIGUOUS') {
    return packageWithoutFeatures(
      'INTENT_AMBIGUOUS', question, asOfDate, intent, cardsWithoutVerifiedData,
      featureData.ownedCards.length
    );
  }

  const requestedCodes = new Set(intent.candidateFeatureTypeCodes);
  const relevantFeatures = featureData.features.filter(({ featureType }) =>
    requestedCodes.has(featureType.code)
  );
  if (relevantFeatures.length === 0) {
    return packageWithoutFeatures(
      cardsWithoutVerifiedData.length === featureData.ownedCards.length
        ? 'VERIFIED_DATA_NOT_AVAILABLE'
        : 'BENEFIT_NOT_FOUND_IN_VERIFIED_DATA',
      question,
      asOfDate,
      intent,
      cardsWithoutVerifiedData,
      featureData.ownedCards.length
    );
  }

  const evaluatedFeatures = relevantFeatures.map((feature) =>
    prepareFeatureEvidence(feature, question, asOfDate, suppliedInputs)
  );
  const sourceWarnings = collectSourceWarnings(evaluatedFeatures, intent.kind);
  const outcome = sourceWarnings.length > 0 && intent.kind !== 'EVALUATE'
    ? 'REVIEW_REQUIRED'
    : overallOutcome(intent.kind, evaluatedFeatures);

  return {
    asOfDate,
    cardsWithoutVerifiedData,
    evaluatedFeatures,
    intent,
    originalQuestion: question,
    outcome,
    ownedCardCount: featureData.ownedCards.length,
    sourceWarnings,
  };
}

function prepareFeatureEvidence(
  feature: AskCardFeature,
  question: string,
  asOfDate: string,
  suppliedValues: Readonly<Record<string, unknown>>
): AskEvaluatedFeatureEvidence {
  const definitions = evaluationInputDefinitions(feature);
  const extracted = extractSafeScenarioInputs(question, feature.featureType.code, definitions);
  const supplied = prepareSuppliedInputs(suppliedValues, definitions);
  const inputs = mergeInputs(extracted, supplied.inputs);
  const inputValues = Object.fromEntries(inputs.map(({ code, value }) => [code, value]));

  return {
    card: feature.card,
    citations: collectEvidenceLinks(feature),
    evaluation: evaluateFeature({ asOfDate, feature, inputs: inputValues }),
    featureId: feature.id,
    featureTypeCode: feature.featureType.code,
    inputs,
    inputWarnings: supplied.warnings,
    presentation: feature.presentation,
  };
}

function evaluationInputDefinitions(feature: AskCardFeature): AskEvaluationInputDefinition[] {
  return [...new Map(
    feature.rules.flatMap(({ inputs }) => inputs.map(({ definition }) => [definition.code, definition] as const))
  ).values()];
}

function mergeInputs(
  extracted: readonly AskPreparedInput[],
  supplied: readonly AskPreparedInput[]
): AskPreparedInput[] {
  const merged = new Map(extracted.map((input) => [input.code, input]));
  for (const input of supplied) merged.set(input.code, input);
  return [...merged.values()];
}

function collectEvidenceLinks(feature: AskCardFeature): AskEvidenceLink[] {
  return [
    ...feature.citations.map((reference) => ({ factId: feature.id, factKind: 'FEATURE' as const, reference })),
    ...feature.rules.flatMap((rule) =>
      rule.citations.map((reference) => ({ factId: rule.id, factKind: 'RULE' as const, reference }))
    ),
    ...feature.limits.flatMap((limit) =>
      limit.citations.map((reference) => ({ factId: limit.id, factKind: 'LIMIT' as const, reference }))
    ),
    ...(feature.presentation?.citations.map((reference) => ({
      factId: feature.presentation!.id,
      factKind: 'PRESENTATION' as const,
      reference,
    })) ?? []),
  ];
}

function collectSourceWarnings(
  features: readonly AskEvaluatedFeatureEvidence[],
  kind: AskEvidencePackage['intent']['kind']
): AskSourceWarning[] {
  const warnings = new Map<string, AskSourceWarning>();
  for (const { citations } of features) {
    for (const { factId, factKind, reference } of citations) {
      if (!isEvidenceRelevantToIntent(factKind, kind)) continue;
      const status = reference.source.sourceStatus;
      if (status.known && status.value === 'VERIFIED_CURRENT') continue;
      const existing = warnings.get(reference.source.id);
      if (existing) {
        if (!existing.affectedFactIds.includes(factId)) existing.affectedFactIds.push(factId);
      } else {
        warnings.set(reference.source.id, {
          affectedFactIds: [factId],
          sourceId: reference.source.id,
          sourceStatus: status.raw,
          sourceTitle: reference.source.title,
        });
      }
    }
  }
  return [...warnings.values()];
}

function isEvidenceRelevantToIntent(
  factKind: AskEvidenceLink['factKind'],
  kind: AskEvidencePackage['intent']['kind']
): boolean {
  if (kind === 'DISCOVER') return factKind === 'FEATURE' || factKind === 'PRESENTATION';
  if (kind === 'LIMITS') {
    return factKind === 'FEATURE' || factKind === 'LIMIT' || factKind === 'PRESENTATION';
  }
  return true;
}

function overallOutcome(
  kind: AskEvidencePackage['intent']['kind'],
  features: readonly AskEvaluatedFeatureEvidence[]
): AskOverallOutcome {
  if (kind !== 'EVALUATE') return 'BENEFIT_FOUND_IN_VERIFIED_DATA';
  const statuses = features.map(({ evaluation }) => evaluation.status);
  if (statuses.includes('CONDITIONS_SATISFIED')) return 'CONDITIONS_SATISFIED';
  if (statuses.includes('REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  if (statuses.includes('INSUFFICIENT_INFORMATION')) return 'INSUFFICIENT_INFORMATION';
  return 'CONDITION_NOT_SATISFIED';
}

function packageWithoutFeatures(
  outcome: AskOverallOutcome,
  question: string,
  asOfDate: string,
  intent: AskEvidencePackage['intent'],
  cardsWithoutVerifiedData: AskEvidencePackage['cardsWithoutVerifiedData'],
  ownedCardCount: number
): AskEvidencePackage {
  return {
    asOfDate,
    cardsWithoutVerifiedData,
    evaluatedFeatures: [],
    intent,
    originalQuestion: question,
    outcome,
    ownedCardCount,
    sourceWarnings: [],
  };
}
