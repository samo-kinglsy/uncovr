import type { CardCatalogItem } from '@/lib/cards';

export type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type KnownDatabaseValue<Value extends string> = {
  known: true;
  raw: Value;
  value: Value;
};

export type UnknownDatabaseValue = {
  known: false;
  raw: string;
  value: null;
};

export type DatabaseValue<Value extends string> =
  | KnownDatabaseValue<Value>
  | UnknownDatabaseValue;

export type VerificationStatus = 'DRAFT' | 'REVIEW_REQUIRED' | 'SOURCE_CONFLICT' | 'VERIFIED';
export type SourceStatus =
  | 'CHANGE_DETECTED'
  | 'REVIEW_REQUIRED'
  | 'SOURCE_UNAVAILABLE'
  | 'STALE'
  | 'VERIFIED_CURRENT';
export type RiskLevel = 'HIGH' | 'LOW' | 'MEDIUM';
export type RuleEffect = 'INFORMATIONAL' | 'MUST_MATCH' | 'MUST_NOT_MATCH';
export type RuleOperator =
  | 'EQ'
  | 'GT'
  | 'GTE'
  | 'IN'
  | 'LT'
  | 'LTE'
  | 'PURCHASE_AGE_BETWEEN'
  | 'WITHIN_LAST';
export type RuleGroupOperator = 'AND' | 'OR';
export type EvaluationInputDataType = 'boolean' | 'currency' | 'date' | 'number' | 'string';
export type PresentationItemType = 'CONDITION' | 'LIMITATION';

export type AskCardIdentity = Pick<
  CardCatalogItem,
  'id' | 'issuerName' | 'issuerSlug' | 'name' | 'network' | 'networkTier' | 'slug'
>;

export type AskCardVersionIdentity = {
  effectiveFrom: string;
  effectiveTo: string | null;
  id: string;
  status: string;
  versionNumber: number;
};

export type AskBenefitCategory = {
  code: string;
  name: string;
  sortOrder: number | null;
};

export type AskFeatureType = {
  category: AskBenefitCategory;
  code: string;
  description: string | null;
  id: string;
  name: string;
};

export type AskEvaluationInputDefinition = {
  code: string;
  dataType: DatabaseValue<EvaluationInputDataType>;
  description: string | null;
  id: string;
  name: string;
  questionText: string | null;
};

export type AskRuleInput = {
  definition: AskEvaluationInputDefinition;
  required: boolean;
};

export type AskSourceDocument = {
  authorityLevel: number;
  documentVersion: string | null;
  effectiveDate: string | null;
  id: string;
  issuerName: string;
  issuerSlug: string;
  lastCheckedAt: string | null;
  retrievedAt: string | null;
  sourceStatus: DatabaseValue<SourceStatus>;
  sourceType: string;
  sourceUrl: string;
  title: string;
};

export type AskEvidenceReference = {
  citationId: string;
  evidenceText: string | null;
  pageNumber: number | null;
  section: string | null;
  source: AskSourceDocument;
  verifiedAt: string | null;
};

export type AskFeatureRule = {
  citations: AskEvidenceReference[];
  effectiveFrom: string | null;
  effectiveTo: string | null;
  humanDescription: string | null;
  id: string;
  inputs: AskRuleInput[];
  operator: DatabaseValue<RuleOperator>;
  riskLevel: DatabaseValue<RiskLevel>;
  ruleCategory: string;
  ruleEffect: DatabaseValue<RuleEffect>;
  ruleKey: string;
  unit: string | null;
  value: JsonValue;
  verificationStatus: DatabaseValue<VerificationStatus>;
};

export type AskRuleGroupMember = {
  childGroupId: string | null;
  id: string;
  ruleId: string | null;
  sortOrder: number | null;
};

export type AskRuleGroup = {
  description: string | null;
  id: string;
  members: AskRuleGroupMember[];
  operator: DatabaseValue<RuleGroupOperator>;
  parentGroupId: string | null;
};

export type AskFeatureLimit = {
  amount: number | null;
  citations: AskEvidenceReference[];
  currency: string | null;
  description: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  id: string;
  limitType: string;
  period: string | null;
  quantity: number | null;
  riskLevel: DatabaseValue<RiskLevel>;
  unit: string | null;
  verificationStatus: DatabaseValue<VerificationStatus>;
};

export type AskPresentationItem = {
  featureLimitId: string | null;
  featureRuleId: string | null;
  id: string;
  itemType: DatabaseValue<PresentationItemType>;
  plainLanguageText: string;
  sortOrder: number;
  verificationStatus: DatabaseValue<VerificationStatus>;
  verifiedAt: string | null;
};

export type AskFeaturePresentation = {
  citations: AskEvidenceReference[];
  id: string;
  items: AskPresentationItem[];
  plainLanguageSummary: string;
  shortName: string | null;
  verificationStatus: DatabaseValue<VerificationStatus>;
  verifiedAt: string | null;
};

export type AskCardFeature = {
  card: AskCardIdentity;
  cardVersion: AskCardVersionIdentity;
  citations: AskEvidenceReference[];
  deliveryType: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  featureType: AskFeatureType;
  id: string;
  insurerName: string | null;
  lastVerifiedAt: string | null;
  limits: AskFeatureLimit[];
  presentation: AskFeaturePresentation | null;
  providerName: string | null;
  riskLevel: DatabaseValue<RiskLevel>;
  ruleGroups: AskRuleGroup[];
  rules: AskFeatureRule[];
  summary: string | null;
  verificationStatus: DatabaseValue<VerificationStatus>;
};

export type AskFeatureData = {
  features: AskCardFeature[];
  ownedCards: AskCardIdentity[];
  requestedFeatureTypeCodes: string[];
};

export type GetAskFeatureDataOptions = {
  featureTypeCodes?: readonly string[];
  userId: string;
};

export type AskScenarioInputs = Readonly<Record<string, unknown>>;

export type OperatorEvaluationStatus = 'MATCH' | 'NO_MATCH' | 'REVIEW_REQUIRED';

export type OperatorEvaluation = {
  reason: string | null;
  status: OperatorEvaluationStatus;
};

export type RuleEvaluationStatus =
  | 'FAIL'
  | 'INFORMATIONAL'
  | 'PASS'
  | 'REVIEW_REQUIRED'
  | 'UNKNOWN';

export type AskRuleEvaluation = {
  inputCodes: string[];
  missingInputs: AskEvaluationInputDefinition[];
  predicateStatus: OperatorEvaluationStatus | 'NOT_EVALUATED' | 'UNKNOWN';
  reason: string | null;
  rule: AskFeatureRule;
  status: RuleEvaluationStatus;
};

export type EligibilityNodeStatus = 'FAIL' | 'PASS' | 'REVIEW_REQUIRED' | 'UNKNOWN';

export type AskGroupEvaluation = {
  childGroupResults: AskGroupEvaluation[];
  group: AskRuleGroup;
  missingInputs: AskEvaluationInputDefinition[];
  ruleResults: AskRuleEvaluation[];
  status: EligibilityNodeStatus;
};

export type FeatureEvaluationStatus =
  | 'CONDITION_NOT_SATISFIED'
  | 'CONDITIONS_SATISFIED'
  | 'INSUFFICIENT_INFORMATION'
  | 'REVIEW_REQUIRED';

export type AskFeatureEvaluation = {
  feature: AskCardFeature;
  groupResults: AskGroupEvaluation[];
  informationalRules: AskRuleEvaluation[];
  limits: AskFeatureLimit[];
  missingInputs: AskEvaluationInputDefinition[];
  ruleResults: AskRuleEvaluation[];
  status: FeatureEvaluationStatus;
};

export type EvaluateFeatureOptions = {
  asOfDate: string;
  feature: AskCardFeature;
  inputs: AskScenarioInputs;
};

export type AskIntentKind = 'DISCOVER' | 'EVALUATE' | 'EXPLAIN' | 'LIMITS' | 'SOURCES';
export type AskIntentConfidence = 'HIGH' | 'LOW' | 'MEDIUM';
export type AskIntentResolution = 'AMBIGUOUS' | 'RESOLVED' | 'UNRECOGNIZED';

export type AskIntentClassification = {
  candidateFeatureTypeCodes: string[];
  confidence: AskIntentConfidence;
  kind: AskIntentKind | null;
  matchedPhrases: string[];
  normalizedQuestion: string;
  resolution: AskIntentResolution;
};

export type AskPreparedInput = {
  code: string;
  definition: AskEvaluationInputDefinition;
  origin: 'EXTRACTED' | 'SUPPLIED';
  value: boolean | number | string;
};

export type AskInputWarning = {
  code: string;
  reason: string;
};

export type AskSourceWarning = {
  affectedFactIds: string[];
  sourceId: string;
  sourceStatus: string;
  sourceTitle: string;
};

export type AskEvidenceFactKind = 'FEATURE' | 'LIMIT' | 'PRESENTATION' | 'RULE';

export type AskEvidenceLink = {
  factId: string;
  factKind: AskEvidenceFactKind;
  reference: AskEvidenceReference;
};

export type AskEvaluatedFeatureEvidence = {
  card: AskCardIdentity;
  citations: AskEvidenceLink[];
  evaluation: AskFeatureEvaluation;
  featureId: string;
  featureTypeCode: string;
  inputs: AskPreparedInput[];
  inputWarnings: AskInputWarning[];
  presentation: AskFeaturePresentation | null;
};

export type AskOverallOutcome =
  | 'BENEFIT_FOUND_IN_VERIFIED_DATA'
  | 'BENEFIT_NOT_FOUND_IN_VERIFIED_DATA'
  | 'CONDITION_NOT_SATISFIED'
  | 'CONDITIONS_SATISFIED'
  | 'INSUFFICIENT_INFORMATION'
  | 'INTENT_AMBIGUOUS'
  | 'INTENT_NOT_RECOGNIZED'
  | 'NO_OWNED_CARDS'
  | 'REVIEW_REQUIRED'
  | 'VERIFIED_DATA_NOT_AVAILABLE';

export type AskEvidencePackage = {
  asOfDate: string;
  cardsWithoutVerifiedData: AskCardIdentity[];
  evaluatedFeatures: AskEvaluatedFeatureEvidence[];
  intent: AskIntentClassification;
  originalQuestion: string;
  outcome: AskOverallOutcome;
  ownedCardCount: number;
  sourceWarnings: AskSourceWarning[];
};

export type PrepareAskEvidenceOptions = {
  asOfDate: string;
  featureData: AskFeatureData;
  question: string;
  suppliedInputs?: AskScenarioInputs;
};

export type GetAskEvidenceOptions = {
  asOfDate: string;
  question: string;
  suppliedInputs?: AskScenarioInputs;
  userId: string;
};
