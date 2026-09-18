import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { prepareAskEvidencePackage } from '../evidence.ts';
import { classifyAskIntent, extractSafeScenarioInputs } from '../intent.ts';

import type {
  AskCardFeature,
  AskCardIdentity,
  AskEvaluationInputDefinition,
  AskFeatureData,
  AskFeatureLimit,
  AskFeatureRule,
  DatabaseValue,
  EvaluationInputDataType,
  JsonValue,
  RuleEffect,
  RuleOperator,
  SourceStatus,
} from '../types.ts';

const asOfDate = '2026-09-18';
const rbc = card('rbc', 'RBC Avion Visa Infinite');
const triangle = card('triangle', 'Triangle Mastercard');

describe('deterministic intent classification', () => {
  const cases = [
    ['Do I have rental car insurance?', 'DISCOVER', 'rental_car_collision_damage'],
    ['Does my card cover a rental car for 10 days?', 'EVALUATE', 'rental_car_collision_damage'],
    ['What happens if my flight is delayed for 4 hours?', 'EVALUATE', 'flight_delay'],
    ['How does my emergency medical insurance work?', 'EXPLAIN', 'travel_emergency_medical'],
    ['Can I finance a $500 purchase?', 'EVALUATE', 'installment_financing'],
    ['Can I redeem my CT Money?', 'EVALUATE', 'points_redemption'],
    ['Where does this rental car insurance information come from?', 'SOURCES', 'rental_car_collision_damage'],
    ["What's the maximum rental car insurance period?", 'LIMITS', 'rental_car_collision_damage'],
  ] as const;

  for (const [question, kind, code] of cases) {
    test(question, () => {
      const result = classifyAskIntent(question);
      assert.equal(result.resolution, 'RESOLVED');
      assert.equal(result.kind, kind);
      assert.deepEqual(result.candidateFeatureTypeCodes, [code]);
    });
  }

  test('ambiguous questions retain all candidates without guessing', () => {
    const result = classifyAskIntent('Does trip cancellation or trip interruption insurance apply?');
    assert.equal(result.resolution, 'AMBIGUOUS');
    assert.deepEqual(result.candidateFeatureTypeCodes.sort(), ['trip_cancellation', 'trip_interruption']);
  });

  test('unsupported benefits remain unresolved', () => {
    const result = classifyAskIntent('Do I have dental insurance?');
    assert.equal(result.resolution, 'UNRECOGNIZED');
    assert.deepEqual(result.candidateFeatureTypeCodes, []);
  });
});

describe('safe scenario extraction', () => {
  test('extracts only feature-specific simple values', () => {
    const rentalDuration = input('rental_duration_days', 'number');
    assert.deepEqual(
      extractSafeScenarioInputs('Rental car coverage for 10 days', 'rental_car_collision_damage', [rentalDuration])
        .map(({ code, value }) => [code, value]),
      [['rental_duration_days', 10]]
    );

    const purchaseAmount = input('purchase_amount', 'currency');
    assert.deepEqual(
      extractSafeScenarioInputs('Can I finance a $500 purchase?', 'installment_financing', [purchaseAmount])
        .map(({ code, value }) => [code, value]),
      [['purchase_amount', 500]]
    );
  });

  test('extracts medical age only in medical context and rejects conflicting values', () => {
    const age = input('traveller_age', 'number');
    assert.deepEqual(
      extractSafeScenarioInputs('I am 64 years old and need travel medical insurance', 'travel_emergency_medical', [age])
        .map(({ code, value }) => [code, value]),
      [['traveller_age', 64]]
    );
    assert.deepEqual(
      extractSafeScenarioInputs('Rental car insurance for 10 or 12 days', 'rental_car_collision_damage', [input('rental_duration_days')]),
      []
    );
  });
});

describe('structured evidence packages', () => {
  test('discovery finds a verified benefit without treating missing scenario facts as absence', () => {
    const rental = rentalFeature(rbc);
    const result = build('Do I have rental car insurance?', data([rbc], [rental]));
    assert.equal(result.outcome, 'BENEFIT_FOUND_IN_VERIFIED_DATA');
    assert.equal(result.evaluatedFeatures.length, 1);
    assert.equal(result.evaluatedFeatures[0].evaluation.status, 'INSUFFICIENT_INFORMATION');
    assert.ok(result.evaluatedFeatures[0].citations.some(({ factKind }) => factKind === 'RULE'));
  });

  test('rental duration is extracted but remaining required facts stay missing', () => {
    const result = build(
      'Does my card cover a rental car for 10 days?',
      data([rbc], [rentalFeature(rbc)])
    );
    assert.equal(result.outcome, 'INSUFFICIENT_INFORMATION');
    assert.deepEqual(
      result.evaluatedFeatures[0].inputs.map(({ code, value }) => [code, value]),
      [['rental_duration_days', 10]]
    );
    assert.ok(result.evaluatedFeatures[0].evaluation.missingInputs.length > 0);
  });

  test('flight delay and financing values are extracted into their canonical inputs', () => {
    const flightResult = build(
      'What happens if my flight is delayed for 4 hours?',
      data([rbc], [flightFeature(rbc)])
    );
    assert.equal(flightResult.outcome, 'INSUFFICIENT_INFORMATION');
    assert.equal(flightResult.evaluatedFeatures[0].inputs[0].code, 'delay_duration_hours');
    assert.equal(flightResult.evaluatedFeatures[0].inputs[0].value, 4);

    const financingResult = build(
      'Can I finance a $500 purchase?',
      data([triangle], [financingFeature(triangle)])
    );
    assert.equal(financingResult.outcome, 'INSUFFICIENT_INFORMATION');
    assert.equal(financingResult.evaluatedFeatures[0].inputs[0].code, 'purchase_amount');
    assert.equal(financingResult.evaluatedFeatures[0].inputs[0].value, 500);
  });

  test('redemption evaluation requests facts without inventing inputs', () => {
    const result = build(
      'Can I redeem my CT Money?',
      data([triangle], [redemptionFeature(triangle)])
    );
    assert.equal(result.outcome, 'INSUFFICIENT_INFORMATION');
    assert.deepEqual(result.evaluatedFeatures[0].inputs, []);
    assert.deepEqual(
      result.evaluatedFeatures[0].evaluation.missingInputs.map(({ code }) => code).sort(),
      ['merchant', 'redemption_method', 'reward_earned_on_same_transaction', 'triangle_rewards_member']
    );
  });

  test('source and limit intents preserve traceable data without eligibility prose', () => {
    const rental = rentalFeature(rbc);
    const sourceResult = build(
      'Where does this rental car insurance information come from?',
      data([rbc], [rental])
    );
    assert.equal(sourceResult.outcome, 'BENEFIT_FOUND_IN_VERIFIED_DATA');
    assert.ok(sourceResult.evaluatedFeatures[0].citations.length > 0);

    const limitResult = build(
      "What's the maximum rental car insurance period?",
      data([rbc], [rental])
    );
    assert.equal(limitResult.outcome, 'BENEFIT_FOUND_IN_VERIFIED_DATA');
    assert.equal(limitResult.evaluatedFeatures[0].evaluation.limits[0].quantity, 48);
  });

  test('failed conditions override unrelated missing inputs', () => {
    const result = build(
      'Does my card cover this rental car?',
      data([rbc], [rentalFeature(rbc)]),
      { vehicle_value: 65_001 }
    );
    assert.equal(result.outcome, 'CONDITION_NOT_SATISFIED');
    assert.deepEqual(result.evaluatedFeatures[0].evaluation.missingInputs, []);
  });

  test('same benefit on multiple cards remains independently evaluated', () => {
    const second = card('second', 'Second Card');
    const supplied = {
      authorized_rental_driver: true,
      payment_percentage: 100,
      rental_agency_cdw_declined: true,
      rental_duration_days: 10,
      vehicle_value: 60_000,
    };
    const result = build(
      'Does my card cover a rental car for 10 days?',
      data([rbc, second], [rentalFeature(rbc, 'rental-rbc'), rentalFeature(second, 'rental-second')]),
      supplied
    );
    assert.equal(result.outcome, 'CONDITIONS_SATISFIED');
    assert.equal(result.evaluatedFeatures.length, 2);
    assert.deepEqual(
      result.evaluatedFeatures.map(({ card: owner, evaluation }) => [owner.id, evaluation.status]),
      [['rbc', 'CONDITIONS_SATISFIED'], ['second', 'CONDITIONS_SATISFIED']]
    );
  });

  test('stale evidence creates a traceable warning and review outcome', () => {
    const stale = rentalFeature(rbc);
    stale.citations = [citation('STALE', 'stale-source')];
    const result = build('Do I have rental car insurance?', data([rbc], [stale]));
    assert.equal(result.outcome, 'REVIEW_REQUIRED');
    assert.equal(result.sourceWarnings[0].sourceStatus, 'STALE');
    assert.deepEqual(result.sourceWarnings[0].affectedFactIds, [stale.id]);
  });

  test('absence states distinguish no cards, no dataset, and feature not found', () => {
    assert.equal(build('Do I have rental car insurance?', data([], [])).outcome, 'NO_OWNED_CARDS');
    assert.equal(
      build('Do I have rental car insurance?', data([rbc], [])).outcome,
      'VERIFIED_DATA_NOT_AVAILABLE'
    );
    assert.equal(
      build('Do I have rental car insurance?', data([rbc], [flightFeature(rbc)])).outcome,
      'BENEFIT_NOT_FOUND_IN_VERIFIED_DATA'
    );
  });

  test('ambiguous and unsupported questions remain unresolved', () => {
    const pilotData = data([rbc], [rentalFeature(rbc)]);
    assert.equal(
      build('Trip cancellation or trip interruption insurance?', pilotData).outcome,
      'INTENT_AMBIGUOUS'
    );
    assert.equal(build('Do I have dental insurance?', pilotData).outcome, 'INTENT_NOT_RECOGNIZED');
  });
});

function build(
  question: string,
  featureData: AskFeatureData,
  suppliedInputs: Readonly<Record<string, unknown>> = {}
) {
  return prepareAskEvidencePackage({ asOfDate, featureData, question, suppliedInputs });
}

function data(ownedCards: AskCardIdentity[], features: AskCardFeature[]): AskFeatureData {
  return { features, ownedCards, requestedFeatureTypeCodes: [] };
}

function rentalFeature(owner: AskCardIdentity, id = 'rental'): AskCardFeature {
  return feature(owner, id, 'rental_car_collision_damage', [
    rule('rental_payment_percentage', 'payment_percentage', 'EQ', 100),
    rule('rental_duration', 'rental_duration_days', 'LTE', 48),
    rule('rental_cdw_declined', 'rental_agency_cdw_declined', 'EQ', true),
    rule('rental_driver_authorized', 'authorized_rental_driver', 'EQ', true),
    rule('rental_vehicle_msrp_over_limit', 'vehicle_value', 'GT', 65_000, 'MUST_NOT_MATCH', 'currency'),
  ], [limit('rental-duration', 48, 'days')]);
}

function flightFeature(owner: AskCardIdentity): AskCardFeature {
  return feature(owner, 'flight', 'flight_delay', [
    rule('air_ticket_payment_percentage', 'payment_percentage', 'EQ', 100),
    rule('air_carrier_check_in', 'air_carrier_check_in_completed', 'EQ', true),
    rule('flight_delay_hours', 'delay_duration_hours', 'GTE', 4),
  ]);
}

function financingFeature(owner: AskCardIdentity): AskCardFeature {
  return feature(owner, 'financing', 'installment_financing', [
    rule('financing_plan_requested', 'financing_plan_requested', 'EQ', true),
    rule('credit_approved', 'credit_approved', 'EQ', true),
    rule('triangle_card_payment', 'payment_method', 'EQ', 'triangle_credit_card', 'MUST_MATCH', 'string'),
    rule('purchase_qualifies', 'purchase_qualifies_for_financing', 'EQ', true),
    rule('minimum_purchase_amount', 'purchase_amount', 'GTE', 150, 'MUST_MATCH', 'currency'),
    rule('participating_financing_retailer', 'merchant', 'IN', ['Canadian Tire'], 'MUST_MATCH', 'string'),
    rule('gift_card_purchase', 'purchase_is_gift_card', 'EQ', true, 'MUST_NOT_MATCH', 'boolean'),
  ]);
}

function redemptionFeature(owner: AskCardIdentity): AskCardFeature {
  return feature(owner, 'redemption', 'points_redemption', [
    rule('triangle_rewards_membership', 'triangle_rewards_member', 'EQ', true),
    rule('participating_redemption_retailer', 'merchant', 'IN', ['Canadian Tire'], 'MUST_MATCH', 'string'),
    rule('accepted_redemption_method', 'redemption_method', 'IN', ['program_app'], 'MUST_MATCH', 'string'),
    rule('same_transaction_reward', 'reward_earned_on_same_transaction', 'EQ', true, 'MUST_NOT_MATCH', 'boolean'),
  ]);
}

function feature(
  owner: AskCardIdentity,
  id: string,
  code: string,
  rules: AskFeatureRule[],
  limits: AskFeatureLimit[] = []
): AskCardFeature {
  const featureCitation = citation();
  return {
    card: owner,
    cardVersion: { effectiveFrom: '2026-01-01', effectiveTo: null, id: `version-${owner.id}`, status: 'CURRENT', versionNumber: 1 },
    citations: [featureCitation],
    deliveryType: null,
    effectiveFrom: null,
    effectiveTo: null,
    featureType: { category: { code: 'test', name: 'Test', sortOrder: 1 }, code, description: null, id: `type-${code}`, name: code },
    id,
    insurerName: null,
    lastVerifiedAt: '2026-09-18T00:00:00Z',
    limits,
    presentation: {
      citations: [featureCitation],
      id: `presentation-${id}`,
      items: [],
      plainLanguageSummary: `Plain-language ${code}`,
      shortName: code,
      verificationStatus: known('VERIFIED'),
      verifiedAt: '2026-09-18T00:00:00Z',
    },
    providerName: null,
    riskLevel: known('HIGH'),
    ruleGroups: [],
    rules,
    summary: `Canonical ${code}`,
    verificationStatus: known('VERIFIED'),
  };
}

function rule(
  key: string,
  inputCode: string,
  operator: RuleOperator,
  value: JsonValue,
  effect: RuleEffect = 'MUST_MATCH',
  dataType: EvaluationInputDataType = typeof value === 'boolean' ? 'boolean' : 'number'
): AskFeatureRule {
  return {
    citations: [citation()],
    effectiveFrom: null,
    effectiveTo: null,
    humanDescription: key,
    id: key,
    inputs: [{ definition: input(inputCode, dataType), required: true }],
    operator: known(operator),
    riskLevel: known('HIGH'),
    ruleCategory: 'eligibility',
    ruleEffect: known(effect),
    ruleKey: key,
    unit: null,
    value,
    verificationStatus: known('VERIFIED'),
  };
}

function input(code: string, dataType: EvaluationInputDataType = 'number'): AskEvaluationInputDefinition {
  return { code, dataType: known(dataType), description: null, id: `input-${code}`, name: code, questionText: `What is ${code}?` };
}

function limit(id: string, quantity: number, unit: string): AskFeatureLimit {
  return { amount: null, citations: [citation()], currency: null, description: 'Verified limit', effectiveFrom: null, effectiveTo: null, id, limitType: id, period: null, quantity, riskLevel: known('HIGH'), unit, verificationStatus: known('VERIFIED') };
}

function citation(status: SourceStatus = 'VERIFIED_CURRENT', sourceId = 'source') {
  return {
    citationId: `citation-${sourceId}`,
    evidenceText: 'Evidence',
    pageNumber: 1,
    section: 'Benefits',
    source: {
      authorityLevel: 1,
      documentVersion: '1',
      effectiveDate: '2026-01-01',
      id: sourceId,
      issuerName: 'Issuer',
      issuerSlug: 'issuer',
      lastCheckedAt: '2026-09-18T00:00:00Z',
      retrievedAt: '2026-09-18T00:00:00Z',
      sourceStatus: known(status),
      sourceType: 'certificate',
      sourceUrl: 'https://example.com/source',
      title: 'Official source',
    },
    verifiedAt: '2026-09-18T00:00:00Z',
  };
}

function card(id: string, name: string): AskCardIdentity {
  return { id, issuerName: 'Issuer', issuerSlug: 'issuer', name, network: 'Mastercard', networkTier: null, slug: id };
}

function known<Value extends string>(value: Value): DatabaseValue<Value> {
  return { known: true, raw: value, value };
}
