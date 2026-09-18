import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { evaluateFeature, evaluateRule } from '../evaluator.ts';
import { evaluateOperator } from '../operators.ts';

import type {
  AskCardFeature,
  AskEvaluationInputDefinition,
  AskFeatureLimit,
  AskFeatureRule,
  AskRuleGroup,
  DatabaseValue,
  EvaluationInputDataType,
  JsonValue,
  RuleEffect,
  RuleOperator,
  VerificationStatus,
} from '../types.ts';

const asOfDate = '2026-09-18';

describe('pilot operators', () => {
  const cases: Array<{
    actual: unknown;
    dataType?: EvaluationInputDataType;
    expected: JsonValue;
    operator: RuleOperator;
    status: 'MATCH' | 'NO_MATCH';
  }> = [
    { actual: true, dataType: 'boolean', expected: true, operator: 'EQ', status: 'MATCH' },
    { actual: 64, expected: 65, operator: 'LT', status: 'MATCH' },
    { actual: 48, expected: 48, operator: 'LTE', status: 'MATCH' },
    { actual: 65_001, dataType: 'currency', expected: 65_000, operator: 'GT', status: 'MATCH' },
    { actual: 4, expected: 4, operator: 'GTE', status: 'MATCH' },
    { actual: 'Canadian Tire', dataType: 'string', expected: ['Canadian Tire', 'Sport Chek'], operator: 'IN', status: 'MATCH' },
    { actual: '2026-07-01', dataType: 'date', expected: 90, operator: 'WITHIN_LAST', status: 'MATCH' },
    { actual: '2026-03-01', dataType: 'date', expected: { maximum: 730, minimum: 91 }, operator: 'PURCHASE_AGE_BETWEEN', status: 'MATCH' },
  ];

  for (const scenario of cases) {
    test(scenario.operator, () => {
      const result = evaluateOperator(
        known(scenario.operator),
        scenario.actual,
        scenario.expected,
        input('operator_input', scenario.dataType ?? 'number'),
        asOfDate
      );
      assert.equal(result.status, scenario.status);
    });
  }

  test('date windows are inclusive and reject future dates', () => {
    assert.equal(
      evaluateOperator(known('WITHIN_LAST'), '2026-06-20', 90, input('date', 'date'), asOfDate).status,
      'MATCH'
    );
    assert.equal(
      evaluateOperator(known('WITHIN_LAST'), '2026-09-19', 90, input('date', 'date'), asOfDate).status,
      'NO_MATCH'
    );
  });

  test('unknown operators and unsafe values require review', () => {
    assert.equal(
      evaluateOperator(unknown('BETWEEN'), 10, 10, input('value'), asOfDate).status,
      'REVIEW_REQUIRED'
    );
    assert.equal(
      evaluateOperator(known('GTE'), 10, 'ten', input('value'), asOfDate).status,
      'REVIEW_REQUIRED'
    );
  });
});

describe('rule effects and missing inputs', () => {
  test('MUST_MATCH and MUST_NOT_MATCH convert predicates to pass/fail', () => {
    assert.equal(evaluateRule(rule('required', 'value', 'EQ', 10), { value: 10 }, asOfDate).status, 'PASS');
    assert.equal(evaluateRule(rule('excluded', 'value', 'GT', 10, 'MUST_NOT_MATCH'), { value: 11 }, asOfDate).status, 'FAIL');
  });

  test('informational rules never become eligibility passes', () => {
    const result = evaluateRule(rule('interest', 'interest', 'EQ', 0, 'INFORMATIONAL'), { interest: 0 }, asOfDate);
    assert.equal(result.status, 'INFORMATIONAL');
    assert.equal(result.predicateStatus, 'MATCH');
  });

  test('missing required input is unknown and returned once', () => {
    const definition = input('payment_percentage');
    const result = evaluateRule(ruleWithInputs('payment', [definition], 'EQ', 100), {}, asOfDate);
    assert.equal(result.status, 'UNKNOWN');
    assert.deepEqual(result.missingInputs.map(({ code }) => code), ['payment_percentage']);
  });

  test('unknown verification status and operator require review', () => {
    const unsafeStatus = rule('status', 'value', 'EQ', true);
    unsafeStatus.verificationStatus = unknown('PENDING');
    assert.equal(evaluateRule(unsafeStatus, { value: true }, asOfDate).status, 'REVIEW_REQUIRED');

    const unsafeOperator = rule('operator', 'value', 'EQ', true);
    unsafeOperator.operator = unknown('CONTAINS');
    assert.equal(evaluateRule(unsafeOperator, { value: true }, asOfDate).status, 'REVIEW_REQUIRED');
  });
});

describe('rule groups and relevant missing-input discovery', () => {
  test('AND, OR, nested groups, and ungrouped rules are combined correctly', () => {
    const a = rule('a', 'a', 'EQ', true);
    const b = rule('b', 'b', 'EQ', true);
    const c = rule('c', 'c', 'EQ', true);
    const ungrouped = rule('ungrouped', 'd', 'EQ', true);
    const child = group('child', 'AND', [ruleMember(a), ruleMember(b)], 'root');
    const root = group('root', 'OR', [childMember(child), ruleMember(c)]);
    const result = evaluateFeature({
      asOfDate,
      feature: feature([a, b, c, ungrouped], [root, child]),
      inputs: { a: true, b: true, c: false, d: true },
    });

    assert.equal(result.status, 'CONDITIONS_SATISFIED');
    assert.equal(result.groupResults[0].childGroupResults[0].status, 'PASS');
    assert.deepEqual(result.ruleResults.map(({ rule: item }) => item.ruleKey), ['ungrouped']);
  });

  test('OR pass suppresses missing inputs from unused branches', () => {
    const paidInFull = rule('paid_in_full', 'payment_percentage', 'EQ', 100);
    const wireless = rule('wireless', 'wireless_bill', 'EQ', true);
    const root = group('root', 'OR', [ruleMember(paidInFull), ruleMember(wireless)]);
    const result = evaluateFeature({
      asOfDate,
      feature: feature([paidInFull, wireless], [root]),
      inputs: { payment_percentage: 100 },
    });
    assert.equal(result.status, 'CONDITIONS_SATISFIED');
    assert.deepEqual(result.missingInputs, []);
  });

  test('AND failure suppresses unrelated missing inputs', () => {
    const failed = rule('failed', 'eligible', 'EQ', true);
    const missing = rule('missing', 'payment', 'EQ', 100);
    const result = evaluateFeature({
      asOfDate,
      feature: feature([failed, missing]),
      inputs: { eligible: false },
    });
    assert.equal(result.status, 'CONDITION_NOT_SATISFIED');
    assert.deepEqual(result.missingInputs, []);
  });

  test('review-required nodes cannot accidentally make an unresolved tree pass', () => {
    const safe = rule('safe', 'safe', 'EQ', true);
    const unsafe = rule('unsafe', 'unsafe', 'EQ', true);
    unsafe.operator = unknown('UNSUPPORTED');
    const result = evaluateFeature({
      asOfDate,
      feature: feature([safe, unsafe]),
      inputs: { safe: true, unsafe: true },
    });
    assert.equal(result.status, 'REVIEW_REQUIRED');
  });
});

describe('RBC pilot semantics', () => {
  test('emergency medical uses the correct age/duration branch', () => {
    const resident = rule('canadian_resident', 'canadian_resident', 'EQ', true);
    const health = rule('government_health_plan_active', 'government_health_plan_active', 'EQ', true);
    const underAge = rule('age_under_65', 'traveller_age', 'LT', 65);
    const underDays = rule('trip_days_under_65', 'trip_duration_days', 'LTE', 15);
    const olderAge = rule('age_65_or_older', 'traveller_age', 'GTE', 65);
    const olderDays = rule('trip_days_65_or_older', 'trip_duration_days', 'LTE', 3);
    const under = group('under', 'AND', [ruleMember(underAge), ruleMember(underDays)], 'root');
    const older = group('older', 'AND', [ruleMember(olderAge), ruleMember(olderDays)], 'root');
    const root = group('root', 'OR', [childMember(under), childMember(older)]);
    const medical = feature([resident, health, underAge, underDays, olderAge, olderDays], [root, under, older]);

    assert.equal(evaluateFeature({ asOfDate, feature: medical, inputs: {
      canadian_resident: true,
      government_health_plan_active: true,
      traveller_age: 64,
      trip_duration_days: 10,
    } }).status, 'CONDITIONS_SATISFIED');

    assert.equal(evaluateFeature({ asOfDate, feature: medical, inputs: {
      canadian_resident: true,
      government_health_plan_active: true,
      traveller_age: 65,
      trip_duration_days: 10,
    } }).status, 'CONDITION_NOT_SATISFIED');
  });

  test('rental car 10-day scenario passes while a vehicle over $65,000 fails', () => {
    const rental = feature([
      rule('rental_payment_percentage', 'payment_percentage', 'EQ', 100),
      rule('rental_duration', 'rental_duration_days', 'LTE', 48),
      rule('rental_cdw_declined', 'rental_agency_cdw_declined', 'EQ', true),
      rule('rental_driver_authorized', 'authorized_rental_driver', 'EQ', true),
      rule('rental_vehicle_msrp_over_limit', 'vehicle_value', 'GT', 65_000, 'MUST_NOT_MATCH', 'currency'),
    ]);
    const base = {
      authorized_rental_driver: true,
      payment_percentage: 100,
      rental_agency_cdw_declined: true,
      rental_duration_days: 10,
    };
    assert.equal(evaluateFeature({ asOfDate, feature: rental, inputs: { ...base, vehicle_value: 60_000 } }).status, 'CONDITIONS_SATISFIED');
    assert.equal(evaluateFeature({ asOfDate, feature: rental, inputs: { ...base, vehicle_value: 65_001 } }).status, 'CONDITION_NOT_SATISFIED');
  });

  test('flight delay requires the four-hour threshold', () => {
    const flight = feature([
      rule('air_ticket_payment_percentage', 'payment_percentage', 'EQ', 100),
      rule('air_carrier_check_in', 'air_carrier_check_in_completed', 'EQ', true),
      rule('flight_delay_hours', 'delay_duration_hours', 'GTE', 4),
    ]);
    const inputs = { air_carrier_check_in_completed: true, payment_percentage: 100 };
    assert.equal(evaluateFeature({ asOfDate, feature: flight, inputs: { ...inputs, delay_duration_hours: 4 } }).status, 'CONDITIONS_SATISFIED');
    assert.equal(evaluateFeature({ asOfDate, feature: flight, inputs: { ...inputs, delay_duration_hours: 3.5 } }).status, 'CONDITION_NOT_SATISFIED');
  });

  test('mobile-device alternative purchase branches work independently', () => {
    const paid = rule('device_payment_percentage', 'payment_percentage', 'EQ', 100);
    const wireless = rule('wireless_bill_payment', 'wireless_bill_charged_to_card', 'EQ', true);
    const age = rule('device_days_since_purchase', 'purchase_date', 'PURCHASE_AGE_BETWEEN', { maximum: 730, minimum: 91 }, 'MUST_MATCH', 'date');
    const standing = rule('account_good_standing', 'account_in_good_standing', 'EQ', true);
    const payment = group('payment', 'OR', [ruleMember(paid), ruleMember(wireless)]);
    const mobile = feature([paid, wireless, age, standing], [payment]);
    const shared = { account_in_good_standing: true, purchase_date: '2026-03-01' };

    assert.equal(evaluateFeature({ asOfDate, feature: mobile, inputs: { ...shared, payment_percentage: 100 } }).status, 'CONDITIONS_SATISFIED');
    assert.equal(evaluateFeature({ asOfDate, feature: mobile, inputs: { ...shared, payment_percentage: 0, wireless_bill_charged_to_card: true } }).status, 'CONDITIONS_SATISFIED');
  });
});

describe('Triangle pilot semantics', () => {
  test('$500 financing satisfies evaluative rules and informational rules do not affect eligibility', () => {
    const evaluative = [
      rule('financing_plan_requested', 'financing_plan_requested', 'EQ', true),
      rule('credit_approved', 'credit_approved', 'EQ', true),
      rule('triangle_card_payment', 'payment_method', 'EQ', 'triangle_credit_card', 'MUST_MATCH', 'string'),
      rule('purchase_qualifies', 'purchase_qualifies_for_financing', 'EQ', true),
      rule('minimum_purchase_amount', 'purchase_amount', 'GTE', 150, 'MUST_MATCH', 'currency'),
      rule('participating_financing_retailer', 'merchant', 'IN', ['Canadian Tire', 'Sport Chek'], 'MUST_MATCH', 'string'),
      rule('gift_card_purchase', 'purchase_is_gift_card', 'EQ', true, 'MUST_NOT_MATCH', 'boolean'),
    ];
    const informational = rule('monthly_installment_paid', 'plan_installment_paid_in_full', 'EQ', true, 'INFORMATIONAL');
    const result = evaluateFeature({
      asOfDate,
      feature: feature([...evaluative, informational]),
      inputs: {
        credit_approved: true,
        financing_plan_requested: true,
        merchant: 'Canadian Tire',
        payment_method: 'triangle_credit_card',
        purchase_amount: 500,
        purchase_is_gift_card: false,
        purchase_qualifies_for_financing: true,
      },
    });
    assert.equal(result.status, 'CONDITIONS_SATISFIED');
    assert.equal(result.informationalRules[0].status, 'INFORMATIONAL');
    assert.deepEqual(result.missingInputs, []);
  });

  test('multi-input default fact is preserved but never evaluated as eligibility', () => {
    const eligible = rule('financing_plan_requested', 'financing_plan_requested', 'EQ', true);
    const defaultFact = ruleWithInputs(
      'minimum_payment_default_threshold',
      [input('days_since_statement'), input('minimum_payment_received', 'boolean')],
      'GTE',
      59,
      'INFORMATIONAL'
    );
    const result = evaluateFeature({
      asOfDate,
      feature: feature([eligible, defaultFact]),
      inputs: { financing_plan_requested: true },
    });
    assert.equal(result.status, 'CONDITIONS_SATISFIED');
    assert.equal(result.informationalRules[0].status, 'INFORMATIONAL');
    assert.equal(result.informationalRules[0].predicateStatus, 'NOT_EVALUATED');
    assert.match(result.informationalRules[0].reason ?? '', /2 inputs/);
  });
});

function feature(rules: AskFeatureRule[], ruleGroups: AskRuleGroup[] = []): AskCardFeature {
  return {
    card: { id: 'card', issuerName: 'Issuer', issuerSlug: 'issuer', name: 'Card', network: 'Visa', networkTier: null, slug: 'card' },
    cardVersion: { effectiveFrom: '2026-01-01', effectiveTo: null, id: 'version', status: 'CURRENT', versionNumber: 1 },
    citations: [evidence()],
    deliveryType: null,
    effectiveFrom: null,
    effectiveTo: null,
    featureType: { category: { code: 'test', name: 'Test', sortOrder: 1 }, code: 'test', description: null, id: 'type', name: 'Test' },
    id: 'feature',
    insurerName: null,
    lastVerifiedAt: null,
    limits: [limit('verified', known('VERIFIED')), limit('draft', known('DRAFT'))],
    presentation: null,
    providerName: null,
    riskLevel: known('HIGH'),
    ruleGroups,
    rules,
    summary: null,
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
  return ruleWithInputs(key, [input(inputCode, dataType)], operator, value, effect);
}

function ruleWithInputs(
  key: string,
  definitions: AskEvaluationInputDefinition[],
  operator: RuleOperator,
  value: JsonValue,
  effect: RuleEffect = 'MUST_MATCH'
): AskFeatureRule {
  return {
    citations: [evidence()],
    effectiveFrom: null,
    effectiveTo: null,
    humanDescription: key,
    id: key,
    inputs: definitions.map((definition) => ({ definition, required: true })),
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

function group(
  id: string,
  operator: 'AND' | 'OR',
  members: AskRuleGroup['members'],
  parentGroupId: string | null = null
): AskRuleGroup {
  return { description: id, id, members, operator: known(operator), parentGroupId };
}

function ruleMember(item: AskFeatureRule): AskRuleGroup['members'][number] {
  return { childGroupId: null, id: `member-rule-${item.id}`, ruleId: item.id, sortOrder: 1 };
}

function childMember(item: AskRuleGroup): AskRuleGroup['members'][number] {
  return { childGroupId: item.id, id: `member-group-${item.id}`, ruleId: null, sortOrder: 1 };
}

function limit(id: string, status: DatabaseValue<VerificationStatus>): AskFeatureLimit {
  return { amount: null, citations: [], currency: null, description: null, effectiveFrom: null, effectiveTo: null, id, limitType: 'test', period: null, quantity: null, riskLevel: known('HIGH'), unit: null, verificationStatus: status };
}

function evidence(): AskCardFeature['citations'][number] {
  return {
    citationId: 'citation',
    evidenceText: 'Verified evidence',
    pageNumber: 1,
    section: 'Benefits',
    source: {
      authorityLevel: 1,
      documentVersion: '1',
      effectiveDate: '2026-01-01',
      id: 'source',
      issuerName: 'Issuer',
      issuerSlug: 'issuer',
      lastCheckedAt: '2026-09-18T00:00:00Z',
      retrievedAt: '2026-09-18T00:00:00Z',
      sourceStatus: known('VERIFIED_CURRENT'),
      sourceType: 'certificate',
      sourceUrl: 'https://example.com/source',
      title: 'Source',
    },
    verifiedAt: '2026-09-18T00:00:00Z',
  };
}

function known<Value extends string>(value: Value): DatabaseValue<Value> {
  return { known: true, raw: value, value };
}

function unknown<Value extends string>(raw: string): DatabaseValue<Value> {
  return { known: false, raw, value: null };
}
