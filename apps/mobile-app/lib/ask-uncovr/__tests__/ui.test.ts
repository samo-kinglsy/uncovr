import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  addSuppliedInput,
  canStartPersonalizedCheck,
  convertFollowUpAnswer,
  getAdditionalDetails,
  getAnswerViewModel,
  getCardStatusViewModel,
  getFailedConditionDescriptions,
  getFeatureDisplay,
  getMissingInputs,
  getNextFollowUp,
  getOfficialSources,
  getOutcomeViewModel,
  getPersonalizedFollowUp,
  resetPersonalizedCheck,
  resetSuppliedInputs,
} from '../ui.ts';

import type {
  AskEvaluatedFeatureEvidence,
  AskEvidencePackage,
  AskEvaluationInputDefinition,
  AskFeatureRule,
  AskOverallOutcome,
  AskRuleEvaluation,
  RuleOperator,
} from '../types.ts';

const outcomes: AskOverallOutcome[] = [
  'NO_OWNED_CARDS',
  'INTENT_NOT_RECOGNIZED',
  'INTENT_AMBIGUOUS',
  'BENEFIT_FOUND_IN_VERIFIED_DATA',
  'BENEFIT_NOT_FOUND_IN_VERIFIED_DATA',
  'VERIFIED_DATA_NOT_AVAILABLE',
  'INSUFFICIENT_INFORMATION',
  'CONDITION_NOT_SATISFIED',
  'CONDITIONS_SATISFIED',
  'REVIEW_REQUIRED',
];

describe('Ask UI outcome copy', () => {
  test('all engine outcomes have complete deterministic copy', () => {
    for (const outcome of outcomes) {
      const view = getOutcomeViewModel(outcome);
      assert.ok(view.eyebrow.length > 0);
      assert.ok(view.title.length > 0);
      assert.ok(view.body.length > 0);
    }
  });

  test('satisfied wording never claims the user is covered', () => {
    const view = getOutcomeViewModel('CONDITIONS_SATISFIED');
    const copy = `${view.eyebrow} ${view.title} ${view.body}`.toLowerCase();
    assert.doesNotMatch(copy, /you are covered|coverage confirmed|\bcovered\b/);
    assert.match(copy, /not a claims or coverage decision/);
  });

  test('absence wording remains conservative', () => {
    assert.equal(
      getOutcomeViewModel('BENEFIT_NOT_FOUND_IN_VERIFIED_DATA').body,
      "This benefit was not found in UNCOVR's verified dataset for your cards."
    );
  });
});

describe('Ask UI feature transformations', () => {
  test('per-card statuses remain independent', () => {
    assert.notEqual(
      getCardStatusViewModel('CONDITIONS_SATISFIED').label,
      getCardStatusViewModel('CONDITION_NOT_SATISFIED').label
    );
  });

  test('missing inputs are deduplicated by canonical code', () => {
    const first = evaluatedFeature('first');
    const second = evaluatedFeature('second');
    first.evaluation.missingInputs = [input('payment_percentage'), input('rental_duration_days')];
    second.evaluation.missingInputs = [input('payment_percentage')];
    assert.deepEqual(
      getMissingInputs([first, second]).map(({ code }) => code),
      ['payment_percentage', 'rental_duration_days']
    );
  });

  test('verified presentation is preferred and canonical data is the fallback', () => {
    const presented = evaluatedFeature('presented');
    presented.presentation = {
      citations: [],
      id: 'presentation',
      items: [],
      plainLanguageSummary: 'Plain summary',
      shortName: 'Plain name',
      verificationStatus: known('VERIFIED'),
      verifiedAt: '2026-09-18T00:00:00Z',
    };
    assert.deepEqual(getFeatureDisplay(presented), {
      importantItems: [],
      name: 'Plain name',
      summary: 'Plain summary',
    });

    presented.presentation.verificationStatus = known('DRAFT');
    assert.deepEqual(getFeatureDisplay(presented), {
      importantItems: [],
      name: 'Canonical name',
      summary: 'Canonical summary',
    });
  });

  test('failed rules nested in groups are flattened for display without changing evaluation', () => {
    const feature = evaluatedFeature('grouped-failure');
    const failure = {
      rule: {
        humanDescription: 'The rental vehicle value must be within the eligible maximum.',
        id: 'failed-rule',
        ruleKey: 'vehicle_value_maximum',
      },
      status: 'FAIL',
    } as AskRuleEvaluation;
    feature.evaluation.status = 'CONDITION_NOT_SATISFIED';
    feature.evaluation.groupResults = [{
      childGroupResults: [{
        childGroupResults: [],
        group: {} as never,
        missingInputs: [],
        ruleResults: [failure],
        status: 'FAIL',
      }],
      group: {} as never,
      missingInputs: [],
      ruleResults: [],
      status: 'FAIL',
    }];

    assert.deepEqual(getFailedConditionDescriptions(feature.evaluation), [
      'The rental vehicle value must be within the eligible maximum.',
    ]);
  });
});

describe('Ask follow-up adapter', () => {
  test('benefit-found copy confidently states existence without deciding the scenario', () => {
    const feature = evaluatedFeature('rental');
    feature.evaluation.missingInputs = [input('payment_percentage')];
    feature.presentation = {
      citations: [],
      id: 'rental-presentation',
      items: [],
      plainLanguageSummary: 'Summary',
      shortName: 'Rental car damage insurance',
      verificationStatus: known('VERIFIED'),
      verifiedAt: '2026-09-18T00:00:00Z',
    };
    const answer = getAnswerViewModel(evidence('INSUFFICIENT_INFORMATION', [feature]));
    assert.equal(answer.title, 'Rental car damage insurance');
    assert.equal(answer.body, 'Your Card rental includes rental car damage insurance.');
    assert.equal(answer.supportingText, 'This benefit applies when key conditions are met.');
    assert.doesNotMatch(`${answer.title} ${answer.body} ${answer.supportingText}`, /may help pay/i);
  });

  test('missing inputs wait for an explicit personalized-check action', () => {
    const feature = evaluatedFeature('gated');
    feature.evaluation.missingInputs = [input('payment_percentage')];
    assert.equal(
      getPersonalizedFollowUp('INSUFFICIENT_INFORMATION', [feature], false),
      null
    );
    assert.equal(
      canStartPersonalizedCheck('INSUFFICIENT_INFORMATION', [feature], false),
      true
    );
    assert.equal(
      getPersonalizedFollowUp('INSUFFICIENT_INFORMATION', [feature], true)?.definition.code,
      'payment_percentage'
    );
  });

  test('answer and follow-up helpers avoid repetitive missing-information terminology', () => {
    const feature = evaluatedFeature('copy');
    feature.evaluation.missingInputs = [input('payment_percentage')];
    const copy = JSON.stringify({
      answer: getAnswerViewModel(evidence('INSUFFICIENT_INFORMATION', [feature])),
      followUp: getPersonalizedFollowUp('INSUFFICIENT_INFORMATION', [feature], true),
    });
    assert.doesNotMatch(copy, /one more detail|more information needed/i);
  });

  test('key conditions are taken from verified presentation evidence', () => {
    const feature = evaluatedFeature('derived-condition');
    feature.presentation = {
      citations: [],
      id: 'presentation',
      items: [{
        featureLimitId: null,
        featureRuleId: 'source-rule',
        id: 'item',
        itemType: known('CONDITION'),
        plainLanguageText: 'Evidence-derived condition text.',
        sortOrder: 1,
        verificationStatus: known('VERIFIED'),
        verifiedAt: '2026-09-18T00:00:00Z',
      }],
      plainLanguageSummary: 'Summary',
      shortName: 'Benefit',
      verificationStatus: known('VERIFIED'),
      verifiedAt: '2026-09-18T00:00:00Z',
    };
    assert.deepEqual(getFeatureDisplay(feature).importantItems, [
      'Evidence-derived condition text.',
    ]);
  });

  test('selects the first deduplicated missing input deterministically across cards', () => {
    const first = evaluatedFeature('first');
    const second = evaluatedFeature('second');
    first.evaluation.missingInputs = [input('payment_percentage'), input('rental_duration_days')];
    second.evaluation.missingInputs = [input('payment_percentage')];

    assert.equal(
      getNextFollowUp('INSUFFICIENT_INFORMATION', [first, second])?.definition.code,
      'payment_percentage'
    );
  });

  test('converts boolean answers to canonical booleans', () => {
    const followUp = followUpFor(input('rental_agency_cdw_declined', 'boolean'));
    assert.deepEqual(convertFollowUpAnswer(followUp, true), { error: null, value: true });
    assert.deepEqual(convertFollowUpAnswer(followUp, 'yes'), {
      error: 'Choose Yes or No.',
      value: null,
    });
  });

  test('validates number and currency answers as finite canonical numbers', () => {
    const numberFollowUp = followUpFor(input('rental_duration_days', 'number'));
    const currencyFollowUp = followUpFor(input('vehicle_value', 'currency'));
    assert.deepEqual(convertFollowUpAnswer(numberFollowUp, '10'), { error: null, value: 10 });
    assert.deepEqual(convertFollowUpAnswer(currencyFollowUp, '65000.50'), {
      error: null,
      value: 65000.5,
    });
    assert.notEqual(convertFollowUpAnswer(numberFollowUp, '').error, null);
    assert.notEqual(convertFollowUpAnswer(currencyFollowUp, 'not money').error, null);
  });

  test('derives finite string choices and preserves their canonical values', () => {
    const feature = evaluatedFeature('choices');
    const definition = input('redemption_method', 'string');
    feature.evaluation.missingInputs = [definition];
    feature.evaluation.ruleResults = [unknownRule(
      definition,
      'IN',
      ['triangle_rewards_card', 'program_app']
    )];
    const followUp = getNextFollowUp('INSUFFICIENT_INFORMATION', [feature]);
    assert.equal(followUp?.control, 'string-options');
    assert.deepEqual(followUp?.options.map(({ value }) => value), [
      'program_app',
      'triangle_rewards_card',
    ]);
    assert.deepEqual(convertFollowUpAnswer(followUp!, 'program_app'), {
      error: null,
      value: 'program_app',
    });
  });

  test('rejects unsafe or inconsistent string-choice rules', () => {
    const definition = input('merchant', 'string');
    const unsupported = evaluatedFeature('unsupported');
    unsupported.evaluation.missingInputs = [definition];
    unsupported.evaluation.ruleResults = [unknownRule(definition, 'GT', 10)];
    assert.equal(
      getNextFollowUp('INSUFFICIENT_INFORMATION', [unsupported])?.control,
      'unsupported'
    );

    const inconsistent = evaluatedFeature('inconsistent');
    inconsistent.evaluation.missingInputs = [definition];
    inconsistent.evaluation.ruleResults = [
      unknownRule(definition, 'IN', ['Canadian Tire'], 'first'),
      unknownRule(definition, 'IN', ['SportChek'], 'second'),
    ];
    assert.equal(
      getNextFollowUp('INSUFFICIENT_INFORMATION', [inconsistent])?.control,
      'unsupported'
    );
  });

  test('accumulates supplied inputs without changing existing canonical values', () => {
    const first = addSuppliedInput({}, 'rental_duration_days', 10);
    const second = addSuppliedInput(first, 'rental_agency_cdw_declined', true);
    assert.deepEqual(second, {
      rental_agency_cdw_declined: true,
      rental_duration_days: 10,
    });
    assert.deepEqual(first, { rental_duration_days: 10 });
  });

  test('starting a new question or restarting clears accumulated inputs', () => {
    const accumulated = addSuppliedInput({}, 'rental_duration_days', 10);
    assert.deepEqual(accumulated, { rental_duration_days: 10 });
    assert.deepEqual(resetSuppliedInputs(), {});
    assert.equal(resetPersonalizedCheck(), false);
  });

  test('uses only newly relevant missing inputs after reevaluation', () => {
    const before = evaluatedFeature('before');
    before.evaluation.missingInputs = [input('branch_a'), input('branch_b')];
    const after = evaluatedFeature('after');
    after.evaluation.missingInputs = [input('branch_b')];
    assert.equal(getNextFollowUp('INSUFFICIENT_INFORMATION', [before])?.definition.code, 'branch_a');
    assert.equal(getNextFollowUp('INSUFFICIENT_INFORMATION', [after])?.definition.code, 'branch_b');
  });

  test('stops follow-ups for terminal deterministic outcomes', () => {
    const feature = evaluatedFeature('terminal');
    feature.evaluation.missingInputs = [input('unused')];
    for (const outcome of [
      'CONDITION_NOT_SATISFIED',
      'CONDITIONS_SATISFIED',
      'REVIEW_REQUIRED',
    ] as const) {
      assert.equal(getNextFollowUp(outcome, [feature]), null);
    }
  });
});

describe('Ask details and official sources', () => {
  test('deduplicates source documents while keeping user-facing titles', () => {
    const feature = evaluatedFeature('sources');
    feature.citations = [
      evidenceLink('citation-one', 'source-one', 'RBC Certificate of Insurance', 'https://example.com/one.pdf'),
      evidenceLink('citation-two', 'source-one', 'RBC Certificate of Insurance', 'https://example.com/one.pdf'),
    ];
    assert.deepEqual(getOfficialSources(feature), [{
      clickable: true,
      id: 'source-one',
      title: 'RBC Certificate of Insurance',
      url: 'https://example.com/one.pdf',
    }]);
  });

  test('invalid or missing source URLs are never clickable and IDs are not used as titles', () => {
    const feature = evaluatedFeature('invalid-sources');
    feature.citations = [
      evidenceLink('citation-invalid', 'internal-source-id', '', 'javascript:alert(1)'),
      evidenceLink('citation-missing', 'missing-url-source', 'Official benefit guide', ''),
    ];
    const sources = getOfficialSources(feature);
    assert.deepEqual(sources.map(({ clickable, title, url }) => ({ clickable, title, url })), [
      { clickable: false, title: 'Issuer official benefit document', url: null },
      { clickable: false, title: 'Official benefit guide', url: null },
    ]);
    assert.doesNotMatch(sources.map(({ title }) => title).join(' '), /internal-source-id/);
  });

  test('additional details exclude key-condition anchors and exact duplicate text', () => {
    const feature = evaluatedFeature('details');
    feature.presentation = {
      citations: [],
      id: 'presentation',
      items: [{
        featureLimitId: 'key-limit',
        featureRuleId: null,
        id: 'key-item',
        itemType: known('LIMITATION'),
        plainLanguageText: 'Rental period is limited to 48 days.',
        sortOrder: 1,
        verificationStatus: known('VERIFIED'),
        verifiedAt: '2026-09-18T00:00:00Z',
      }],
      plainLanguageSummary: 'Summary',
      shortName: 'Benefit',
      verificationStatus: known('VERIFIED'),
      verifiedAt: '2026-09-18T00:00:00Z',
    };
    feature.evaluation.limits = [
      featureLimit('key-limit', 'Rental period is limited to 48 days.'),
      featureLimit('additional-limit', 'A separate verified qualification.'),
      featureLimit('duplicate-limit', 'A separate verified qualification.'),
    ];
    assert.deepEqual(getAdditionalDetails(feature), ['A separate verified qualification.']);
  });

  test('does not create an empty More Details model', () => {
    assert.deepEqual(getAdditionalDetails(evaluatedFeature('no-details')), []);
  });

  test('official sources remain available after personalized terminal outcomes', () => {
    const feature = evaluatedFeature('terminal-source');
    feature.citations = [
      evidenceLink('citation', 'source', 'Official terms', 'https://example.com/terms'),
    ];
    for (const status of ['CONDITION_NOT_SATISFIED', 'CONDITIONS_SATISFIED', 'REVIEW_REQUIRED'] as const) {
      feature.evaluation.status = status;
      assert.equal(getOfficialSources(feature).length, 1);
    }
  });

  test('helper-generated edge-state copy does not expose engine enum or rule terminology', () => {
    const copy = outcomes.map((outcome) => JSON.stringify(getOutcomeViewModel(outcome))).join(' ');
    assert.doesNotMatch(copy, /CONDITIONS_SATISFIED|INSUFFICIENT_INFORMATION|MUST_MATCH|rule_id|operator/i);
    assert.notEqual(
      getOutcomeViewModel('BENEFIT_NOT_FOUND_IN_VERIFIED_DATA').body,
      getOutcomeViewModel('VERIFIED_DATA_NOT_AVAILABLE').body
    );
  });
});

function evaluatedFeature(id: string): AskEvaluatedFeatureEvidence {
  return {
    card: {
      id: `card-${id}`,
      issuerName: 'Issuer',
      issuerSlug: 'issuer',
      name: `Card ${id}`,
      network: 'Visa',
      networkTier: null,
      slug: `card-${id}`,
    },
    citations: [],
    evaluation: {
      feature: {
        card: {
          id: `card-${id}`,
          issuerName: 'Issuer',
          issuerSlug: 'issuer',
          name: `Card ${id}`,
          network: 'Visa',
          networkTier: null,
          slug: `card-${id}`,
        },
        cardVersion: {
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          id: 'version',
          status: 'CURRENT',
          versionNumber: 1,
        },
        citations: [],
        deliveryType: null,
        effectiveFrom: null,
        effectiveTo: null,
        featureType: {
          category: { code: 'insurance', name: 'Insurance', sortOrder: 1 },
          code: 'test',
          description: null,
          id: 'type',
          name: 'Canonical name',
        },
        id: `feature-${id}`,
        insurerName: null,
        lastVerifiedAt: null,
        limits: [],
        presentation: null,
        providerName: null,
        riskLevel: known('HIGH'),
        ruleGroups: [],
        rules: [],
        summary: 'Canonical summary',
        verificationStatus: known('VERIFIED'),
      },
      groupResults: [],
      informationalRules: [],
      limits: [],
      missingInputs: [],
      ruleResults: [],
      status: 'INSUFFICIENT_INFORMATION',
    },
    featureId: `feature-${id}`,
    featureTypeCode: 'test',
    inputWarnings: [],
    inputs: [],
    presentation: null,
  };
}

function evidence(
  outcome: AskEvidencePackage['outcome'],
  evaluatedFeatures: AskEvaluatedFeatureEvidence[]
): AskEvidencePackage {
  return {
    asOfDate: '2026-09-18',
    cardsWithoutVerifiedData: [],
    evaluatedFeatures,
    intent: {
      candidateFeatureTypeCodes: ['test'],
      confidence: 'HIGH',
      kind: 'EVALUATE',
      matchedPhrases: ['test'],
      normalizedQuestion: 'test',
      resolution: 'RESOLVED',
    },
    originalQuestion: 'Test question',
    outcome,
    ownedCardCount: 1,
    sourceWarnings: [],
  };
}

function evidenceLink(citationId: string, sourceId: string, title: string, sourceUrl: string) {
  return {
    factId: 'feature',
    factKind: 'FEATURE' as const,
    reference: {
      citationId,
      evidenceText: null,
      pageNumber: null,
      section: null,
      source: {
        authorityLevel: 1,
        documentVersion: null,
        effectiveDate: null,
        id: sourceId,
        issuerName: 'Issuer',
        issuerSlug: 'issuer',
        lastCheckedAt: null,
        retrievedAt: null,
        sourceStatus: known('VERIFIED_CURRENT'),
        sourceType: 'official_terms',
        sourceUrl,
        title,
      },
      verifiedAt: '2026-09-18T00:00:00Z',
    },
  };
}

function featureLimit(id: string, description: string) {
  return {
    amount: null,
    citations: [],
    currency: null,
    description,
    effectiveFrom: null,
    effectiveTo: null,
    id,
    limitType: 'test',
    period: null,
    quantity: null,
    riskLevel: known('LOW'),
    unit: null,
    verificationStatus: known('VERIFIED'),
  };
}

function input(
  code: string,
  dataType: 'boolean' | 'currency' | 'date' | 'number' | 'string' = 'number'
): AskEvaluationInputDefinition {
  return {
    code,
    dataType: known(dataType),
    description: null,
    id: `input-${code}`,
    name: code,
    questionText: `What is ${code}?`,
  };
}

function followUpFor(definition: AskEvaluationInputDefinition) {
  const feature = evaluatedFeature(`follow-up-${definition.code}`);
  feature.evaluation.missingInputs = [definition];
  return getNextFollowUp('INSUFFICIENT_INFORMATION', [feature])!;
}

function unknownRule(
  definition: AskEvaluationInputDefinition,
  operator: RuleOperator,
  value: AskFeatureRule['value'],
  id = 'rule'
): AskRuleEvaluation {
  return {
    inputCodes: [definition.code],
    missingInputs: [definition],
    predicateStatus: 'UNKNOWN' as const,
    reason: null,
    rule: {
      citations: [],
      effectiveFrom: null,
      effectiveTo: null,
      humanDescription: null,
      id,
      inputs: [{ definition, required: true }],
      operator: known(operator),
      riskLevel: known('LOW'),
      ruleCategory: 'test',
      ruleEffect: known('MUST_MATCH'),
      ruleKey: id,
      unit: null,
      value,
      verificationStatus: known('VERIFIED'),
    },
    status: 'UNKNOWN' as const,
  };
}

function known<Value extends string>(value: Value) {
  return { known: true as const, raw: value, value };
}
