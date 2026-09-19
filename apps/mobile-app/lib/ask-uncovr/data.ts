import { getOwnedCards } from '@/lib/cards';
import { supabase } from '@/lib/supabase';

import type {
  AskCardFeature,
  AskCardIdentity,
  AskEvidenceReference,
  AskEvaluationInputDefinition,
  AskFeatureData,
  AskFeatureLimit,
  AskFeaturePresentation,
  AskFeatureRule,
  AskPresentationItem,
  AskRuleGroup,
  AskSourceDocument,
  DatabaseValue,
  EvaluationInputDataType,
  GetAskFeatureDataOptions,
  JsonValue,
  PresentationItemType,
  RiskLevel,
  RuleEffect,
  RuleGroupOperator,
  RuleOperator,
  SourceStatus,
  VerificationStatus,
} from '@/lib/ask-uncovr/types';

const verificationStatuses = ['DRAFT', 'VERIFIED', 'REVIEW_REQUIRED', 'SOURCE_CONFLICT'] as const;
const sourceStatuses = [
  'VERIFIED_CURRENT',
  'CHANGE_DETECTED',
  'REVIEW_REQUIRED',
  'SOURCE_UNAVAILABLE',
  'STALE',
] as const;
const riskLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
const ruleEffects = ['MUST_MATCH', 'MUST_NOT_MATCH', 'INFORMATIONAL'] as const;
const ruleOperators = [
  'EQ',
  'LT',
  'LTE',
  'GT',
  'GTE',
  'IN',
  'WITHIN_LAST',
  'PURCHASE_AGE_BETWEEN',
] as const;
const groupOperators = ['AND', 'OR'] as const;
const inputDataTypes = ['boolean', 'currency', 'date', 'number', 'string'] as const;
const presentationItemTypes = ['CONDITION', 'LIMITATION'] as const;

type Related<Row> = Row | Row[] | null;

type IssuerRow = { name: string; slug: string };
type SourceDocumentRow = {
  authority_level: number;
  document_version: string | null;
  effective_date: string | null;
  id: string;
  issuer: Related<IssuerRow>;
  last_checked_at: string | null;
  retrieved_at: string | null;
  source_status: string;
  source_type: string;
  source_url: string;
  title: string;
};
type CitationRow = {
  evidence_text: string | null;
  id: string;
  page_number: number | null;
  section: string | null;
  source_document: Related<SourceDocumentRow>;
  verified_at: string | null;
};
type CitationLinkRow = { citation: Related<CitationRow> };
type EvaluationInputRow = {
  code: string;
  data_type: string;
  description: string | null;
  id: string;
  name: string;
  question_text: string | null;
};
type RuleInputRow = { evaluation_input: Related<EvaluationInputRow>; required: boolean };
type RuleRow = {
  citation_links: Related<CitationLinkRow>;
  effective_from: string | null;
  effective_to: string | null;
  human_description: string | null;
  id: string;
  inputs: Related<RuleInputRow>;
  operator: string;
  risk_level: string;
  rule_category: string;
  rule_effect: string;
  rule_key: string;
  unit: string | null;
  value_json: unknown;
  verification_status: string;
};
type RuleGroupMemberRow = {
  child_group_id: string | null;
  id: string;
  rule_id: string | null;
  sort_order: number | null;
};
type RuleGroupRow = {
  description: string | null;
  id: string;
  members: Related<RuleGroupMemberRow>;
  operator: string;
  parent_group_id: string | null;
};
type LimitRow = {
  amount: number | string | null;
  citation_links: Related<CitationLinkRow>;
  currency: string | null;
  description: string | null;
  effective_from: string | null;
  effective_to: string | null;
  id: string;
  limit_type: string;
  period: string | null;
  quantity: number | string | null;
  risk_level: string;
  unit: string | null;
  verification_status: string;
};
type PresentationItemRow = {
  feature_limit_id: string | null;
  feature_rule_id: string | null;
  id: string;
  item_type: string;
  plain_language_text: string;
  sort_order: number;
  verification_status: string;
  verified_at: string | null;
};
type PresentationRow = {
  citation_links: Related<CitationLinkRow>;
  id: string;
  items: Related<PresentationItemRow>;
  plain_language_summary: string;
  short_name: string | null;
  verification_status: string;
  verified_at: string | null;
};
type CategoryRow = { code: string; name: string; sort_order: number | null };
type FeatureTypeRow = {
  category: Related<CategoryRow>;
  code: string;
  description: string | null;
  id: string;
  name: string;
};
type CardVersionRow = {
  card_id: string;
  effective_from: string;
  effective_to: string | null;
  id: string;
  status: string;
  version_number: number;
};
type FeatureRow = {
  card_version: Related<CardVersionRow>;
  citation_links: Related<CitationLinkRow>;
  delivery_type: string | null;
  effective_from: string | null;
  effective_to: string | null;
  feature_type: Related<FeatureTypeRow>;
  id: string;
  insurer_name: string | null;
  last_verified_at: string | null;
  limits: Related<LimitRow>;
  presentation: Related<PresentationRow>;
  provider_name: string | null;
  risk_level: string;
  rule_groups: Related<RuleGroupRow>;
  rules: Related<RuleRow>;
  summary: string | null;
  verification_status: string;
};

const citationSelection = `
  citation:source_citations!inner (
    id,
    page_number,
    section,
    evidence_text,
    verified_at,
    source_document:source_documents!inner (
      id,
      source_type,
      title,
      source_url,
      document_version,
      effective_date,
      authority_level,
      retrieved_at,
      last_checked_at,
      source_status,
      issuer:issuers!inner (
        name,
        slug
      )
    )
  )
`;

const featureSelection = `
  id,
  summary,
  delivery_type,
  provider_name,
  insurer_name,
  effective_from,
  effective_to,
  verification_status,
  risk_level,
  last_verified_at,
  card_version:card_versions!inner (
    id,
    card_id,
    version_number,
    effective_from,
    effective_to,
    status
  ),
  feature_type:feature_types!inner (
    id,
    code,
    name,
    description,
    category:benefit_categories!inner (
      code,
      name,
      sort_order
    )
  ),
  citation_links:card_feature_citations (
    ${citationSelection}
  ),
  rules:feature_rules (
    id,
    rule_category,
    rule_effect,
    rule_key,
    operator,
    value_json,
    unit,
    human_description,
    risk_level,
    verification_status,
    effective_from,
    effective_to,
    inputs:rule_inputs (
      required,
      evaluation_input:evaluation_inputs!inner (
        id,
        code,
        name,
        data_type,
        question_text,
        description
      )
    ),
    citation_links:feature_rule_citations (
      ${citationSelection}
    )
  ),
  rule_groups (
    id,
    operator,
    parent_group_id,
    description,
    members:rule_group_members!rule_group_members_rule_group_id_fkey (
      id,
      rule_id,
      child_group_id,
      sort_order
    )
  ),
  limits:feature_limits (
    id,
    limit_type,
    amount,
    currency,
    quantity,
    unit,
    period,
    description,
    verification_status,
    risk_level,
    effective_from,
    effective_to,
    citation_links:feature_limit_citations (
      ${citationSelection}
    )
  ),
  presentation:card_feature_presentations (
    id,
    short_name,
    plain_language_summary,
    verification_status,
    verified_at,
    items:card_feature_presentation_items (
      id,
      item_type,
      plain_language_text,
      feature_rule_id,
      feature_limit_id,
      sort_order,
      verification_status,
      verified_at
    ),
    citation_links:card_feature_presentation_citations (
      ${citationSelection}
    )
  )
`;

export async function getAskFeatureData({
  featureTypeCodes = [],
  userId,
}: GetAskFeatureDataOptions): Promise<AskFeatureData> {
  const requestedFeatureTypeCodes = uniqueNonEmpty(featureTypeCodes);
  const ownedCards = await getOwnedCards(userId);
  const normalizedOwnedCards = ownedCards.map(toCardIdentity);

  if (ownedCards.length === 0) {
    return { features: [], ownedCards: [], requestedFeatureTypeCodes };
  }

  let query = supabase
    .from('card_features')
    .select(featureSelection)
    .eq('verification_status', 'VERIFIED')
    .eq('card_version.status', 'CURRENT')
    .eq('presentation.verification_status', 'VERIFIED')
    .in(
      'card_version.card_id',
      ownedCards.map(({ id }) => id)
    );

  if (requestedFeatureTypeCodes.length > 0) {
    query = query.in('feature_type.code', requestedFeatureTypeCodes);
  }

  const { data, error } = await query;

  if (error) throw error;

  const cardsById = new Map(normalizedOwnedCards.map((card) => [card.id, card]));

  return {
    features: (data as FeatureRow[]).map((row) => mapFeature(row, cardsById)),
    ownedCards: normalizedOwnedCards,
    requestedFeatureTypeCodes,
  };
}

function mapFeature(row: FeatureRow, cardsById: ReadonlyMap<string, AskCardIdentity>): AskCardFeature {
  const cardVersion = requiredRelated(row.card_version, `card feature ${row.id} card version`);
  const card = cardsById.get(cardVersion.card_id);
  const featureType = requiredRelated(row.feature_type, `card feature ${row.id} feature type`);
  const category = requiredRelated(featureType.category, `feature type ${featureType.id} category`);

  if (!card) throw new Error(`Card feature ${row.id} references a card the user does not own.`);
  if (cardVersion.status !== 'CURRENT') {
    throw new Error(`Card feature ${row.id} was returned for non-current card version ${cardVersion.id}.`);
  }

  return {
    card,
    cardVersion: {
      effectiveFrom: cardVersion.effective_from,
      effectiveTo: cardVersion.effective_to,
      id: cardVersion.id,
      status: cardVersion.status,
      versionNumber: cardVersion.version_number,
    },
    citations: mapCitationLinks(row.citation_links),
    deliveryType: row.delivery_type,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    featureType: {
      category: { code: category.code, name: category.name, sortOrder: category.sort_order },
      code: featureType.code,
      description: featureType.description,
      id: featureType.id,
      name: featureType.name,
    },
    id: row.id,
    insurerName: row.insurer_name,
    lastVerifiedAt: row.last_verified_at,
    limits: relatedRows(row.limits).map(mapLimit),
    presentation: mapPresentation(row.presentation, row.id),
    providerName: row.provider_name,
    riskLevel: classify(row.risk_level, riskLevels),
    ruleGroups: relatedRows(row.rule_groups).map(mapRuleGroup),
    rules: relatedRows(row.rules).map(mapRule),
    summary: row.summary,
    verificationStatus: classify(row.verification_status, verificationStatuses),
  };
}

function mapRule(row: RuleRow): AskFeatureRule {
  return {
    citations: mapCitationLinks(row.citation_links),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    humanDescription: row.human_description,
    id: row.id,
    inputs: relatedRows(row.inputs).map((input) => ({
      definition: mapEvaluationInput(
        requiredRelated(input.evaluation_input, `rule ${row.id} evaluation input`)
      ),
      required: input.required,
    })),
    operator: classify<RuleOperator>(row.operator, ruleOperators),
    riskLevel: classify<RiskLevel>(row.risk_level, riskLevels),
    ruleCategory: row.rule_category,
    ruleEffect: classify<RuleEffect>(row.rule_effect, ruleEffects),
    ruleKey: row.rule_key,
    unit: row.unit,
    value: toJsonValue(row.value_json, `rule ${row.id} value_json`),
    verificationStatus: classify<VerificationStatus>(
      row.verification_status,
      verificationStatuses
    ),
  };
}

function mapEvaluationInput(row: EvaluationInputRow): AskEvaluationInputDefinition {
  return {
    code: row.code,
    dataType: classify<EvaluationInputDataType>(row.data_type, inputDataTypes),
    description: row.description,
    id: row.id,
    name: row.name,
    questionText: row.question_text,
  };
}

function mapRuleGroup(row: RuleGroupRow): AskRuleGroup {
  return {
    description: row.description,
    id: row.id,
    members: relatedRows(row.members)
      .map((member) => {
        const anchorCount = Number(member.rule_id !== null) + Number(member.child_group_id !== null);
        if (anchorCount !== 1) {
          throw new Error(`Rule-group member ${member.id} must reference exactly one rule or child group.`);
        }

        return {
          childGroupId: member.child_group_id,
          id: member.id,
          ruleId: member.rule_id,
          sortOrder: member.sort_order,
        };
      })
      .sort(compareNullableSortOrder),
    operator: classify<RuleGroupOperator>(row.operator, groupOperators),
    parentGroupId: row.parent_group_id,
  };
}

function mapLimit(row: LimitRow): AskFeatureLimit {
  return {
    amount: toNullableNumber(row.amount, `feature limit ${row.id} amount`),
    citations: mapCitationLinks(row.citation_links),
    currency: row.currency,
    description: row.description,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    id: row.id,
    limitType: row.limit_type,
    period: row.period,
    quantity: toNullableNumber(row.quantity, `feature limit ${row.id} quantity`),
    riskLevel: classify<RiskLevel>(row.risk_level, riskLevels),
    unit: row.unit,
    verificationStatus: classify<VerificationStatus>(
      row.verification_status,
      verificationStatuses
    ),
  };
}

function mapPresentation(value: Related<PresentationRow>, featureId: string): AskFeaturePresentation | null {
  const rows = relatedRows(value);
  if (rows.length === 0) return null;
  if (rows.length > 1) throw new Error(`Card feature ${featureId} has multiple presentations.`);

  const row = rows[0];
  return {
    citations: mapCitationLinks(row.citation_links),
    id: row.id,
    items: relatedRows(row.items).map(mapPresentationItem).sort((a, b) => a.sortOrder - b.sortOrder),
    plainLanguageSummary: row.plain_language_summary,
    shortName: row.short_name,
    verificationStatus: classify<VerificationStatus>(
      row.verification_status,
      verificationStatuses
    ),
    verifiedAt: row.verified_at,
  };
}

function mapPresentationItem(row: PresentationItemRow): AskPresentationItem {
  const anchorCount = Number(row.feature_rule_id !== null) + Number(row.feature_limit_id !== null);
  if (anchorCount !== 1) {
    throw new Error(`Presentation item ${row.id} must reference exactly one rule or limit.`);
  }

  return {
    featureLimitId: row.feature_limit_id,
    featureRuleId: row.feature_rule_id,
    id: row.id,
    itemType: classify<PresentationItemType>(row.item_type, presentationItemTypes),
    plainLanguageText: row.plain_language_text,
    sortOrder: row.sort_order,
    verificationStatus: classify<VerificationStatus>(
      row.verification_status,
      verificationStatuses
    ),
    verifiedAt: row.verified_at,
  };
}

function mapCitationLinks(value: Related<CitationLinkRow>): AskEvidenceReference[] {
  return relatedRows(value).map((link) => {
    const citation = requiredRelated(link.citation, 'citation link citation');
    const source = requiredRelated(
      citation.source_document,
      `citation ${citation.id} source document`
    );

    return {
      citationId: citation.id,
      evidenceText: citation.evidence_text,
      pageNumber: citation.page_number,
      section: citation.section,
      source: mapSourceDocument(source),
      verifiedAt: citation.verified_at,
    };
  });
}

function mapSourceDocument(row: SourceDocumentRow): AskSourceDocument {
  const issuer = requiredRelated(row.issuer, `source document ${row.id} issuer`);
  return {
    authorityLevel: row.authority_level,
    documentVersion: row.document_version,
    effectiveDate: row.effective_date,
    id: row.id,
    issuerName: issuer.name,
    issuerSlug: issuer.slug,
    lastCheckedAt: row.last_checked_at,
    retrievedAt: row.retrieved_at,
    sourceStatus: classify<SourceStatus>(row.source_status, sourceStatuses),
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    title: row.title,
  };
}

function toCardIdentity(card: Awaited<ReturnType<typeof getOwnedCards>>[number]): AskCardIdentity {
  return {
    id: card.id,
    issuerName: card.issuerName,
    issuerSlug: card.issuerSlug,
    name: card.name,
    network: card.network,
    networkTier: card.networkTier,
    slug: card.slug,
  };
}

function classify<Value extends string>(
  raw: string,
  knownValues: readonly Value[]
): DatabaseValue<Value> {
  if ((knownValues as readonly string[]).includes(raw)) {
    const value = raw as Value;
    return { known: true, raw: value, value };
  }

  return { known: false, raw, value: null };
}

function relatedRows<Row>(value: Related<Row>): Row[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function requiredRelated<Row>(value: Related<Row>, relationship: string): Row {
  const rows = relatedRows(value);
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one ${relationship}; received ${rows.length}.`);
  }
  return rows[0];
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toNullableNumber(value: number | string | null, field: string): number | null {
  if (value === null) return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} is not a finite number.`);
  return number;
}

function toJsonValue(value: unknown, field: string): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${field} contains a non-finite number.`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => toJsonValue(item, field));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonValue(item, field)])
    );
  }
  throw new Error(`${field} contains an unsupported JSON value.`);
}

function compareNullableSortOrder(
  left: { sortOrder: number | null },
  right: { sortOrder: number | null }
): number {
  return (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER);
}
