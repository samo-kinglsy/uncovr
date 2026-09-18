import type {
  AskEvaluationInputDefinition,
  DatabaseValue,
  JsonValue,
  OperatorEvaluation,
  RuleOperator,
} from './types.ts';

const millisecondsPerDay = 86_400_000;

export function evaluateOperator(
  operator: DatabaseValue<RuleOperator>,
  actual: unknown,
  expected: JsonValue,
  input: AskEvaluationInputDefinition,
  asOfDate: string
): OperatorEvaluation {
  if (!operator.known) return review(`Unknown rule operator: ${operator.raw}.`);
  if (!input.dataType.known) {
    return review(`Unknown data type for input ${input.code}: ${input.dataType.raw}.`);
  }

  const normalizedActual = normalizeActual(actual, input);
  if (!normalizedActual.ok) return review(normalizedActual.reason);

  switch (operator.value) {
    case 'EQ':
      if (!isComparablePrimitive(expected) || typeof normalizedActual.value !== typeof expected) {
        return review('EQ requires input and rule values of the same primitive type.');
      }
      return comparison(normalizedActual.value === expected);
    case 'LT':
      return numericComparison(normalizedActual.value, expected, (left, right) => left < right);
    case 'LTE':
      return numericComparison(normalizedActual.value, expected, (left, right) => left <= right);
    case 'GT':
      return numericComparison(normalizedActual.value, expected, (left, right) => left > right);
    case 'GTE':
      return numericComparison(normalizedActual.value, expected, (left, right) => left >= right);
    case 'IN':
      if (!Array.isArray(expected)) return review('IN requires an array rule value.');
      if (!expected.every(
        (candidate) => isComparablePrimitive(candidate) && typeof candidate === typeof normalizedActual.value
      )) {
        return review('IN requires an array of values matching the input type.');
      }
      return comparison(expected.some((candidate) => candidate === normalizedActual.value));
    case 'WITHIN_LAST':
      return evaluateWithinLast(normalizedActual.value, expected, asOfDate);
    case 'PURCHASE_AGE_BETWEEN':
      return evaluatePurchaseAgeBetween(normalizedActual.value, expected, asOfDate);
  }
}

function normalizeActual(
  actual: unknown,
  input: AskEvaluationInputDefinition
): { ok: true; value: boolean | number | string } | { ok: false; reason: string } {
  if (!input.dataType.known) return { ok: false, reason: `Unknown input type for ${input.code}.` };

  switch (input.dataType.value) {
    case 'boolean':
      return typeof actual === 'boolean'
        ? { ok: true, value: actual }
        : invalidInput(input.code, 'a boolean');
    case 'currency':
    case 'number':
      return typeof actual === 'number' && Number.isFinite(actual)
        ? { ok: true, value: actual }
        : invalidInput(input.code, 'a finite number');
    case 'date': {
      const date = parseDateOnly(actual);
      return date ? { ok: true, value: date.iso } : invalidInput(input.code, 'a valid YYYY-MM-DD date');
    }
    case 'string':
      return typeof actual === 'string'
        ? { ok: true, value: actual }
        : invalidInput(input.code, 'a string');
  }
}

function numericComparison(
  actual: boolean | number | string,
  expected: JsonValue,
  compare: (left: number, right: number) => boolean
): OperatorEvaluation {
  if (typeof actual !== 'number' || typeof expected !== 'number' || !Number.isFinite(expected)) {
    return review('Numeric comparison requires finite numeric input and rule values.');
  }
  return comparison(compare(actual, expected));
}

function evaluateWithinLast(
  actual: boolean | number | string,
  expected: JsonValue,
  asOfDate: string
): OperatorEvaluation {
  if (typeof actual !== 'string' || typeof expected !== 'number' || !Number.isFinite(expected)) {
    return review('WITHIN_LAST requires a date input and a finite numeric day count.');
  }
  if (expected < 0) return review('WITHIN_LAST cannot use a negative day count.');

  const age = ageInDays(actual, asOfDate);
  if (age === null) return review('WITHIN_LAST requires valid date-only input and as-of values.');
  return comparison(age >= 0 && age <= expected);
}

function evaluatePurchaseAgeBetween(
  actual: boolean | number | string,
  expected: JsonValue,
  asOfDate: string
): OperatorEvaluation {
  if (typeof actual !== 'string' || !isJsonObject(expected)) {
    return review('PURCHASE_AGE_BETWEEN requires a date input and an object rule value.');
  }
  const minimum = expected.minimum;
  const maximum = expected.maximum;
  if (
    typeof minimum !== 'number' ||
    typeof maximum !== 'number' ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum < 0 ||
    maximum < minimum
  ) {
    return review('PURCHASE_AGE_BETWEEN requires a valid minimum and maximum day count.');
  }

  const age = ageInDays(actual, asOfDate);
  if (age === null) {
    return review('PURCHASE_AGE_BETWEEN requires valid date-only input and as-of values.');
  }
  return comparison(age >= minimum && age <= maximum);
}

function ageInDays(dateValue: string, asOfDate: string): number | null {
  const date = parseDateOnly(dateValue);
  const asOf = parseDateOnly(asOfDate);
  if (!date || !asOf) return null;
  return (asOf.time - date.time) / millisecondsPerDay;
}

function parseDateOnly(value: unknown): { iso: string; time: number } | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { iso: value, time };
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isComparablePrimitive(value: JsonValue): value is boolean | number | string {
  return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string';
}

function comparison(matches: boolean): OperatorEvaluation {
  return { reason: null, status: matches ? 'MATCH' : 'NO_MATCH' };
}

function review(reason: string): OperatorEvaluation {
  return { reason, status: 'REVIEW_REQUIRED' };
}

function invalidInput(
  code: string,
  expected: string
): { ok: false; reason: string } {
  return { ok: false, reason: `Input ${code} must be ${expected}.` };
}
