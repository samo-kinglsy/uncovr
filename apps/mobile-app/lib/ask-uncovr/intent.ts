import type {
  AskEvaluationInputDefinition,
  AskIntentClassification,
  AskIntentKind,
  AskInputWarning,
  AskPreparedInput,
  AskScenarioInputs,
} from './types.ts';

type PilotFeatureTypeCode =
  | 'baggage_delay'
  | 'extended_warranty'
  | 'flight_delay'
  | 'hotel_motel_burglary'
  | 'installment_financing'
  | 'mobile_device_insurance'
  | 'points_redemption'
  | 'purchase_protection'
  | 'rental_car_collision_damage'
  | 'travel_accident'
  | 'travel_emergency_medical'
  | 'trip_cancellation'
  | 'trip_interruption';

type AliasEntry = {
  aliases: readonly string[];
  code: PilotFeatureTypeCode;
};

export const pilotFeatureAliases: readonly AliasEntry[] = [
  { code: 'travel_emergency_medical', aliases: ['emergency medical insurance', 'travel medical insurance', 'emergency medical coverage', 'travel medical coverage'] },
  { code: 'travel_accident', aliases: ['travel accident insurance', 'travel accident coverage', 'common carrier accident insurance', 'common carrier accident coverage'] },
  { code: 'rental_car_collision_damage', aliases: ['rental car insurance', 'rental vehicle insurance', 'rental car coverage', 'rental vehicle coverage', 'rental car damage', 'rental vehicle damage', 'collision damage waiver', 'rental cdw', 'rental ldw'] },
  { code: 'trip_cancellation', aliases: ['trip cancellation insurance', 'trip cancellation coverage', 'cancelled trip insurance', 'canceled trip insurance', 'trip cancellation'] },
  { code: 'trip_interruption', aliases: ['trip interruption insurance', 'trip interruption coverage', 'interrupted trip insurance', 'trip interruption'] },
  { code: 'baggage_delay', aliases: ['baggage delay insurance', 'baggage delay coverage', 'delayed baggage', 'baggage delayed', 'luggage delay', 'delayed luggage'] },
  { code: 'flight_delay', aliases: ['flight delay insurance', 'flight delay coverage', 'delayed flight', 'flight delayed', 'flight is delayed', 'flight delay'] },
  { code: 'hotel_motel_burglary', aliases: ['hotel burglary insurance', 'hotel burglary coverage', 'motel burglary insurance', 'hotel room burglary', 'hotel theft insurance'] },
  { code: 'purchase_protection', aliases: ['purchase protection', 'purchase security', 'new purchase insurance', 'item purchase protection'] },
  { code: 'extended_warranty', aliases: ['extended warranty', 'warranty extension', 'double the warranty'] },
  { code: 'mobile_device_insurance', aliases: ['mobile device insurance', 'cell phone insurance', 'phone insurance', 'smartphone insurance', 'mobile phone coverage'] },
  { code: 'installment_financing', aliases: ['installment financing', 'instalment financing', 'equal payments financing', 'equal payment plan', 'finance a purchase', 'finance my purchase', 'financing a purchase', 'finance'] },
  { code: 'points_redemption', aliases: ['redeem ct money', 'use ct money', 'ct money redemption', 'redeem canadian tire money', 'use canadian tire money', 'points redemption', 'ct money', 'canadian tire money'] },
] as const;

export function classifyAskIntent(question: string): AskIntentClassification {
  const normalizedQuestion = normalizeText(question);
  const aliasMatches = pilotFeatureAliases.flatMap(({ aliases, code }) =>
    aliases
      .filter((alias) => containsPhrase(normalizedQuestion, alias))
      .map((alias) => ({ alias, code }))
  );
  const matches = matchesRentalCarScenario(normalizedQuestion)
    ? [
        ...aliasMatches,
        { alias: 'rental vehicle scenario', code: 'rental_car_collision_damage' as const },
      ]
    : aliasMatches;
  const codes = [...new Set(matches.map(({ code }) => code))];

  if (codes.length === 0) {
    return {
      candidateFeatureTypeCodes: [],
      confidence: 'LOW',
      kind: null,
      matchedPhrases: [],
      normalizedQuestion,
      resolution: 'UNRECOGNIZED',
    };
  }
  if (codes.length > 1) {
    return {
      candidateFeatureTypeCodes: codes,
      confidence: 'LOW',
      kind: null,
      matchedPhrases: matches.map(({ alias }) => alias),
      normalizedQuestion,
      resolution: 'AMBIGUOUS',
    };
  }

  return {
    candidateFeatureTypeCodes: codes,
    confidence: confidenceFor(matches.map(({ alias }) => alias)),
    kind: classifyKind(normalizedQuestion),
    matchedPhrases: matches.map(({ alias }) => alias),
    normalizedQuestion,
    resolution: 'RESOLVED',
  };
}

export function extractSafeScenarioInputs(
  question: string,
  featureTypeCode: string,
  definitions: readonly AskEvaluationInputDefinition[]
): AskPreparedInput[] {
  const normalized = normalizeText(question);
  const candidates: Array<{ code: string; value: number }> = [];

  if (featureTypeCode === 'rental_car_collision_damage') {
    addSingleMeasurement(candidates, normalized, 'rental_duration_days', 'days?');
  } else if (featureTypeCode === 'travel_emergency_medical') {
    addSingleMeasurement(candidates, normalized, 'trip_duration_days', 'days?');
    const age = extractSingleNumber(normalized, [
      /\b(?:i am|im|traveller is|traveler is|insured person is|age is|aged)\s+(\d{1,3})(?:\s+years?\s+old)?\b/g,
      /\b(\d{1,3})\s+years?\s+old\b/g,
    ]);
    if (age !== null) candidates.push({ code: 'traveller_age', value: age });
  } else if (featureTypeCode === 'flight_delay' || featureTypeCode === 'baggage_delay') {
    addSingleMeasurement(candidates, normalized, 'delay_duration_hours', 'hours?');
  } else if (featureTypeCode === 'installment_financing') {
    const amount = extractSingleNumber(normalized, [
      /\$\s*(\d+(?:\.\d{1,2})?)\b/g,
      /\b(\d+(?:\.\d{1,2})?)\s*(?:cad|dollars?)\b/g,
    ]);
    if (amount !== null) candidates.push({ code: 'purchase_amount', value: amount });
  }

  const definitionsByCode = new Map(definitions.map((definition) => [definition.code, definition]));
  return candidates.flatMap(({ code, value }) => {
    const definition = definitionsByCode.get(code);
    if (!definition || validateInputValue(definition, value) !== null) return [];
    return [{ code, definition, origin: 'EXTRACTED' as const, value }];
  });
}

export function prepareSuppliedInputs(
  values: AskScenarioInputs,
  definitions: readonly AskEvaluationInputDefinition[]
): { inputs: AskPreparedInput[]; warnings: AskInputWarning[] } {
  const definitionsByCode = new Map(definitions.map((definition) => [definition.code, definition]));
  const inputs: AskPreparedInput[] = [];
  const warnings: AskInputWarning[] = [];

  for (const [code, value] of Object.entries(values)) {
    const definition = definitionsByCode.get(code);
    if (!definition) continue;
    const reason = validateInputValue(definition, value);
    if (reason) {
      warnings.push({ code, reason });
    } else {
      inputs.push({ code, definition, origin: 'SUPPLIED', value: value as boolean | number | string });
    }
  }
  return { inputs, warnings };
}

export function validateInputValue(
  definition: AskEvaluationInputDefinition,
  value: unknown
): string | null {
  if (!definition.dataType.known) return `Input ${definition.code} has an unknown data type.`;
  switch (definition.dataType.value) {
    case 'boolean':
      return typeof value === 'boolean' ? null : `Input ${definition.code} must be a boolean.`;
    case 'currency':
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : `Input ${definition.code} must be a finite number.`;
    case 'date':
      return isDateOnly(value) ? null : `Input ${definition.code} must be a valid YYYY-MM-DD date.`;
    case 'string':
      return typeof value === 'string' ? null : `Input ${definition.code} must be a string.`;
  }
}

function classifyKind(question: string): AskIntentKind {
  if (/\b(source|sources|citation|citations|where (?:did|does|is|are).*(?:come from|from)|official terms|proof)\b/.test(question)) return 'SOURCES';
  if (/\b(max|maximum|limit|limits|how much|how many|how long)\b/.test(question)) return 'LIMITS';
  if (/\b(how does|how do|explain|what is|tell me about)\b/.test(question)) return 'EXPLAIN';
  if (/\b(can i|could i|am i|would i|will i|will my card|does my card|do my cards|do i need|eligible|qualify|what happens if)\b/.test(question)) {
    return /\bdo i have\b/.test(question) ? 'DISCOVER' : 'EVALUATE';
  }
  if (/\b(do i have|which (?:of )?my cards?|is there)\b/.test(question)) return 'DISCOVER';
  return 'DISCOVER';
}

function confidenceFor(aliases: readonly string[]): 'HIGH' | 'MEDIUM' {
  return aliases.some((alias) => alias.split(' ').length >= 3) ? 'HIGH' : 'MEDIUM';
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9$\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsPhrase(question: string, phrase: string): boolean {
  return (` ${question} `).includes(` ${normalizeText(phrase)} `);
}

function matchesRentalCarScenario(question: string): boolean {
  const hasRentalVehicleContext = [
    /\brental (?:car|vehicle)\b/,
    /\b(?:rent|rented|renting) (?:a |an |the )?(?:car|vehicle)\b/,
    /\brental companys?\b/,
    /\b(?:in|to) (?:a |an |the |my |your |their |our )?rental\b/,
  ].some((pattern) => pattern.test(question));
  const hasBenefitLossOrWaiverContext = [
    /\b(?:crash|crashed|crashes|crashing|collision|accident|hit)\b/,
    /\b(?:damage|damaged|damages|damaging|stolen|theft)\b/,
    /\b(?:cover|covered|covers|covering|coverage|protect|protected|protects|protecting|protection|insurance|pay|paid|pays|paying|payment)\b/,
    /\b(?:damage waiver|cdw|ldw|decline|declined|declines|declining)\b/,
  ].some((pattern) => pattern.test(question));

  return hasRentalVehicleContext && hasBenefitLossOrWaiverContext;
}

function addSingleMeasurement(
  candidates: Array<{ code: string; value: number }>,
  question: string,
  code: string,
  unitPattern: string
): void {
  if (new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*(?:or|and)\\s*\\d+(?:\\.\\d+)?\\s*${unitPattern}\\b`).test(question)) {
    return;
  }
  const value = extractSingleNumber(question, [new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*${unitPattern}\\b`, 'g')]);
  if (value !== null) candidates.push({ code, value });
}

function extractSingleNumber(value: string, patterns: readonly RegExp[]): number | null {
  const matches = patterns.flatMap((pattern) => [...value.matchAll(pattern)].map((match) => Number(match[1])));
  const unique = [...new Set(matches.filter(Number.isFinite))];
  return unique.length === 1 ? unique[0] : null;
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
