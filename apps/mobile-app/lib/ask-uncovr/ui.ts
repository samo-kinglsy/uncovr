import type {
  AskEvaluatedFeatureEvidence,
  AskEvidencePackage,
  AskEvaluationInputDefinition,
  AskFeatureEvaluation,
  AskFeatureRule,
  AskOverallOutcome,
  AskRuleEvaluation,
  AskScenarioInputs,
} from './types.ts';

export type AskOutcomeViewModel = {
  body: string;
  eyebrow: string;
  supportingText?: string;
  title: string;
};

export type AskCardStatusViewModel = {
  label: string;
  message: string;
};

export type AskFollowUpOption = {
  label: string;
  value: string;
};

export type AskFollowUpViewModel = {
  control: 'boolean' | 'currency' | 'date' | 'number' | 'string-options' | 'unsupported';
  definition: AskEvaluationInputDefinition;
  options: AskFollowUpOption[];
  prompt: string;
};

export type AskFollowUpConversion =
  | { error: null; value: boolean | number | string }
  | { error: string; value: null };

export type AskOfficialSourceViewModel = {
  clickable: boolean;
  id: string;
  title: string;
  url: string | null;
};

const stringOptionLabels: Readonly<Record<string, string>> = {
  additional_cardholder: 'Additional cardholder',
  applicant: 'Primary cardholder',
  applicant_dependent_child: 'Dependent child of the primary cardholder',
  applicant_spouse: 'Spouse of the primary cardholder',
  approved_cardless_method: 'Approved cardless method',
  forced_entry_burglary: 'Burglary involving visible forced entry',
  program_app: 'Triangle app',
  program_payment_card: 'Eligible Triangle payment card',
  triangle_credit_card: 'Triangle credit card',
  triangle_rewards_card: 'Triangle Rewards card',
};

const inputPromptOverrides: Readonly<Record<string, string>> = {
  rental_duration_days: 'How many consecutive days was the vehicle rented?',
  vehicle_value: "What was the rental vehicle's model-year MSRP in Canadian dollars?",
};

const outcomeViews: Record<AskOverallOutcome, AskOutcomeViewModel> = {
  NO_OWNED_CARDS: {
    eyebrow: 'WALLET EMPTY',
    title: 'Add a card to get started',
    body: 'Add a card in My Wallet before UNCOVR can check its verified benefits.',
  },
  INTENT_NOT_RECOGNIZED: {
    eyebrow: 'QUESTION NOT MATCHED',
    title: 'Try asking about a specific benefit',
    body: "UNCOVR couldn't match that question to a benefit currently supported by its verified data.",
  },
  INTENT_AMBIGUOUS: {
    eyebrow: 'MORE DETAIL NEEDED',
    title: 'Ask about one benefit at a time',
    body: 'That question could refer to multiple benefits, so UNCOVR did not guess which one you meant.',
  },
  BENEFIT_FOUND_IN_VERIFIED_DATA: {
    eyebrow: 'VERIFIED BENEFIT FOUND',
    title: 'This benefit appears in your verified card data',
    body: "The benefit appears in UNCOVR's verified dataset for the card or cards shown below. Eligibility has not been established.",
  },
  BENEFIT_NOT_FOUND_IN_VERIFIED_DATA: {
    eyebrow: 'NO VERIFIED MATCH',
    title: 'No matching verified benefit was found',
    body: "This benefit was not found in UNCOVR's verified dataset for your cards.",
  },
  VERIFIED_DATA_NOT_AVAILABLE: {
    eyebrow: 'VERIFIED DATA UNAVAILABLE',
    title: 'Benefit data is still being reviewed',
    body: 'UNCOVR does not yet have verified benefit data for the relevant cards in your wallet.',
  },
  INSUFFICIENT_INFORMATION: {
    eyebrow: 'BENEFIT FOUND',
    title: 'Review the key conditions',
    body: 'This benefit applies when its key conditions are met.',
  },
  CONDITION_NOT_SATISFIED: {
    eyebrow: 'CHECK COMPLETE',
    title: 'One or more conditions were not met',
    body: 'Based on your answers, one or more applicable conditions were not met. This is not an insurer approval or denial decision.',
  },
  CONDITIONS_SATISFIED: {
    eyebrow: 'CHECK COMPLETE',
    title: "Your answers match the key conditions we've checked",
    body: 'Policy terms still apply. This is not a claims or coverage decision.',
  },
  REVIEW_REQUIRED: {
    eyebrow: 'REVIEW REQUIRED',
    title: 'A personalized result is not available',
    body: "UNCOVR can't give a reliable result from the currently verified information. Relevant information or evidence requires review.",
  },
};

export function getOutcomeViewModel(outcome: AskOverallOutcome): AskOutcomeViewModel {
  return outcomeViews[outcome];
}

export function getAnswerViewModel(evidence: AskEvidencePackage): AskOutcomeViewModel {
  if (evidence.outcome === 'CONDITIONS_SATISFIED'
    || evidence.outcome === 'CONDITION_NOT_SATISFIED') {
    return getOutcomeViewModel(evidence.outcome);
  }

  if (evidence.evaluatedFeatures.length > 0
    && (evidence.outcome === 'BENEFIT_FOUND_IN_VERIFIED_DATA'
      || evidence.outcome === 'INSUFFICIENT_INFORMATION')) {
    const first = evidence.evaluatedFeatures[0];
    const benefitName = getFeatureDisplay(first).name;
    const cards = [...new Map(
      evidence.evaluatedFeatures.map(({ card }) => [card.id, card.name] as const)
    ).values()];
    const body = cards.length === 1
      ? `Your ${cards[0]} includes ${sentenceName(benefitName)}.`
      : `${cards.join(', ')} include ${sentenceName(benefitName)}.`;
    return {
      body,
      eyebrow: 'BENEFIT FOUND',
      supportingText: 'This benefit applies when key conditions are met.',
      title: benefitName,
    };
  }

  return getOutcomeViewModel(evidence.outcome);
}

export function getCardStatusViewModel(
  status: AskFeatureEvaluation['status']
): AskCardStatusViewModel {
  switch (status) {
    case 'CONDITIONS_SATISFIED':
      return {
        label: 'KEY CONDITIONS MATCHED',
        message: "Your answers match the key conditions checked for this card. Policy terms still apply.",
      };
    case 'CONDITION_NOT_SATISFIED':
      return {
        label: 'CONDITION NOT SATISFIED',
        message: 'Based on your answers, at least one applicable condition was not met for this card.',
      };
    case 'INSUFFICIENT_INFORMATION':
      return {
        label: 'CHECK IN PROGRESS',
        message: 'Continue answering the current question to check this card.',
      };
    case 'REVIEW_REQUIRED':
      return {
        label: 'REVIEW REQUIRED',
        message: 'The information or evidence for this card requires review before UNCOVR can provide a personalized result.',
      };
  }
}

export function getFeatureDisplay(feature: AskEvaluatedFeatureEvidence): {
  importantItems: string[];
  name: string;
  summary: string | null;
} {
  const canonical = feature.evaluation.feature;
  const presentation = feature.presentation;
  const presentationVerified = presentation?.verificationStatus.known
    && presentation.verificationStatus.value === 'VERIFIED';

  if (!presentation || !presentationVerified) {
    return {
      importantItems: [],
      name: canonical.featureType.name,
      summary: canonical.summary,
    };
  }

  return {
    importantItems: presentation.items
      .filter(({ verificationStatus }) =>
        verificationStatus.known && verificationStatus.value === 'VERIFIED'
      )
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .slice(0, 5)
      .map(({ plainLanguageText }) => plainLanguageText),
    name: presentation.shortName?.trim() || canonical.featureType.name,
    summary: presentation.plainLanguageSummary || canonical.summary,
  };
}

export function getAdditionalDetails(feature: AskEvaluatedFeatureEvidence): string[] {
  const presentation = feature.presentation;
  const verifiedItems = presentation?.verificationStatus.known
    && presentation.verificationStatus.value === 'VERIFIED'
    ? presentation.items
        .filter(({ verificationStatus }) =>
          verificationStatus.known && verificationStatus.value === 'VERIFIED'
        )
        .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];
  const keyItems = verifiedItems.slice(0, 5);
  const keyTexts = new Set(keyItems.map(({ plainLanguageText }) => normalizeDisplayText(plainLanguageText)));
  const keyLimitIds = new Set(
    keyItems.flatMap(({ featureLimitId }) => featureLimitId ? [featureLimitId] : [])
  );
  const candidates = [
    ...verifiedItems.slice(5).map(({ plainLanguageText }) => plainLanguageText),
    ...feature.evaluation.limits
      .filter(({ id, verificationStatus }) =>
        verificationStatus.known
        && verificationStatus.value === 'VERIFIED'
        && !keyLimitIds.has(id)
      )
      .map(formatLimit)
      .filter((detail): detail is string => detail !== null),
  ];

  return [...new Map(
    candidates
      .filter((detail) => !keyTexts.has(normalizeDisplayText(detail)))
      .map((detail) => [normalizeDisplayText(detail), detail] as const)
  ).values()];
}

export function getOfficialSources(
  feature: AskEvaluatedFeatureEvidence
): AskOfficialSourceViewModel[] {
  return [...new Map(feature.citations.map(({ reference }) => {
    const source = reference.source;
    const url = validOfficialUrl(source.sourceUrl);
    return [source.id, {
      clickable: url !== null,
      id: source.id,
      title: source.title.trim() || `${source.issuerName} official benefit document`,
      url,
    }] as const;
  })).values()];
}

export function getMissingInputs(
  features: readonly AskEvaluatedFeatureEvidence[]
): AskEvaluationInputDefinition[] {
  return [...new Map(
    features.flatMap(({ evaluation }) =>
      evaluation.missingInputs.map((definition) => [definition.code, definition] as const)
    )
  ).values()];
}

export function getNextFollowUp(
  outcome: AskOverallOutcome,
  features: readonly AskEvaluatedFeatureEvidence[]
): AskFollowUpViewModel | null {
  if (outcome !== 'INSUFFICIENT_INFORMATION') return null;
  const definition = getMissingInputs(features)[0];
  if (!definition) return null;
  const prompt = definition.questionText?.trim()
    || inputPromptOverrides[definition.code]
    || definition.name;

  if (!definition.dataType.known) {
    return { control: 'unsupported', definition, options: [], prompt };
  }

  switch (definition.dataType.value) {
    case 'boolean':
      return { control: 'boolean', definition, options: [], prompt };
    case 'currency':
      return { control: 'currency', definition, options: [], prompt };
    case 'date':
      return { control: 'date', definition, options: [], prompt };
    case 'number':
      return { control: 'number', definition, options: [], prompt };
    case 'string': {
      const values = deriveSafeStringChoices(definition.code, features);
      return values
        ? {
            control: 'string-options',
            definition,
            options: values.map((value) => ({ label: labelStringOption(value), value })),
            prompt,
          }
        : { control: 'unsupported', definition, options: [], prompt };
    }
  }
}

export function getPersonalizedFollowUp(
  outcome: AskOverallOutcome,
  features: readonly AskEvaluatedFeatureEvidence[],
  personalizedCheckActive: boolean
): AskFollowUpViewModel | null {
  return personalizedCheckActive ? getNextFollowUp(outcome, features) : null;
}

export function canStartPersonalizedCheck(
  outcome: AskOverallOutcome,
  features: readonly AskEvaluatedFeatureEvidence[],
  personalizedCheckActive: boolean
): boolean {
  return !personalizedCheckActive && getNextFollowUp(outcome, features) !== null;
}

export function convertFollowUpAnswer(
  followUp: AskFollowUpViewModel,
  rawValue: boolean | string
): AskFollowUpConversion {
  switch (followUp.control) {
    case 'boolean':
      return typeof rawValue === 'boolean'
        ? { error: null, value: rawValue }
        : { error: 'Choose Yes or No.', value: null };
    case 'currency':
    case 'number': {
      if (typeof rawValue !== 'string' || rawValue.trim() === '') {
        return { error: 'Enter a number.', value: null };
      }
      const value = Number(rawValue.trim());
      return Number.isFinite(value)
        ? { error: null, value }
        : { error: 'Enter a valid number.', value: null };
    }
    case 'date':
      return typeof rawValue === 'string' && isDateOnly(rawValue.trim())
        ? { error: null, value: rawValue.trim() }
        : { error: 'Enter a valid date as YYYY-MM-DD.', value: null };
    case 'string-options':
      return typeof rawValue === 'string'
        && followUp.options.some(({ value }) => value === rawValue)
        ? { error: null, value: rawValue }
        : { error: 'Choose one of the available options.', value: null };
    case 'unsupported':
      return { error: 'This information cannot be collected safely yet.', value: null };
  }
}

export function addSuppliedInput(
  inputs: AskScenarioInputs,
  code: string,
  value: boolean | number | string
): AskScenarioInputs {
  return { ...inputs, [code]: value };
}

export function resetSuppliedInputs(): AskScenarioInputs {
  return {};
}

export function resetPersonalizedCheck(): boolean {
  return false;
}

export function getFailedConditionDescriptions(
  evaluation: AskFeatureEvaluation
): string[] {
  if (evaluation.status !== 'CONDITION_NOT_SATISFIED') return [];

  const rules = [
    ...evaluation.ruleResults,
    ...evaluation.groupResults.flatMap(flattenGroupRules),
  ];

  return [...new Map(
    rules
      .filter(({ status }) => status === 'FAIL')
      .map(({ rule }) => [rule.id, rule.humanDescription || rule.ruleKey] as const)
  ).values()];
}

function flattenGroupRules(
  group: AskFeatureEvaluation['groupResults'][number]
): AskRuleEvaluation[] {
  return [
    ...group.ruleResults,
    ...group.childGroupResults.flatMap(flattenGroupRules),
  ];
}

function deriveSafeStringChoices(
  inputCode: string,
  features: readonly AskEvaluatedFeatureEvidence[]
): string[] | null {
  const rules = features.flatMap(({ evaluation }) => [
    ...evaluation.ruleResults,
    ...evaluation.groupResults.flatMap(flattenGroupRules),
  ]).filter(({ rule, status }) =>
    status === 'UNKNOWN'
    && rule.inputs.some(({ definition, required }) => required && definition.code === inputCode)
  ).map(({ rule }) => rule);
  if (rules.length === 0) return null;

  const choiceSets = rules.map(stringChoicesForRule);
  if (choiceSets.some((choices) => choices === null)) return null;
  const [first, ...rest] = choiceSets as string[][];
  const normalizedFirst = [...new Set(first)].sort();
  if (normalizedFirst.length === 0) return null;
  return rest.every((choices) =>
    JSON.stringify([...new Set(choices)].sort()) === JSON.stringify(normalizedFirst)
  ) ? normalizedFirst : null;
}

function stringChoicesForRule(rule: AskFeatureRule): string[] | null {
  if (!rule.operator.known) return null;
  if (rule.operator.value === 'EQ' && typeof rule.value === 'string') return [rule.value];
  if (rule.operator.value === 'IN'
    && Array.isArray(rule.value)
    && rule.value.every((value): value is string => typeof value === 'string')) {
    return rule.value;
  }
  return null;
}

function labelStringOption(value: string): string {
  return stringOptionLabels[value]
    ?? value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function sentenceName(value: string): string {
  return /^[A-Z][a-z]/.test(value) ? value[0].toLowerCase() + value.slice(1) : value;
}

function formatLimit(limit: AskEvaluatedFeatureEvidence['evaluation']['limits'][number]): string | null {
  if (limit.description?.trim()) return limit.description.trim();
  const parts = [
    limit.amount === null ? null : [formatNumber(limit.amount), limit.currency].filter(Boolean).join(' '),
    limit.quantity === null ? null : [formatNumber(limit.quantity), limit.unit].filter(Boolean).join(' '),
    limit.period,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function normalizeDisplayText(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function validOfficialUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
}
