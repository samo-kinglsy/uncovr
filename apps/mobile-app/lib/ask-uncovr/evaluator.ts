import { evaluateOperator } from './operators.ts';

import type {
  AskEvaluationInputDefinition,
  AskFeatureEvaluation,
  AskFeatureRule,
  AskGroupEvaluation,
  AskRuleEvaluation,
  EligibilityNodeStatus,
  EvaluateFeatureOptions,
  FeatureEvaluationStatus,
  RuleGroupOperator,
} from './types.ts';

type EligibilityNode = {
  missingInputs: AskEvaluationInputDefinition[];
  status: EligibilityNodeStatus;
};

export function evaluateFeature({
  asOfDate,
  feature,
  inputs,
}: EvaluateFeatureOptions): AskFeatureEvaluation {
  const informationalRules: AskRuleEvaluation[] = [];
  const evaluativeRuleResults = new Map<string, AskRuleEvaluation>();

  for (const rule of feature.rules) {
    const result = evaluateRule(rule, inputs, asOfDate);
    if (rule.ruleEffect.known && rule.ruleEffect.value === 'INFORMATIONAL') {
      informationalRules.push(result);
    } else {
      evaluativeRuleResults.set(rule.id, result);
    }
  }

  if (!isVerified(feature.verificationStatus) || !hasCurrentEvidence(feature.citations)) {
    return buildResult('REVIEW_REQUIRED', [], [], informationalRules, feature, []);
  }

  const groupsById = new Map(feature.ruleGroups.map((group) => [group.id, group]));
  const groupedRuleIds = new Set(
    feature.ruleGroups.flatMap((group) =>
      group.members.flatMap((member) => (member.ruleId ? [member.ruleId] : []))
    )
  );
  const rootGroups = feature.ruleGroups.filter((group) => group.parentGroupId === null);
  const groupResults = rootGroups.map((group) =>
    evaluateGroup(group.id, groupsById, evaluativeRuleResults, new Set())
  );
  const ungroupedResults = [...evaluativeRuleResults.values()].filter(
    ({ rule }) => !groupedRuleIds.has(rule.id)
  );
  const topLevelNodes: EligibilityNode[] = [
    ...groupResults,
    ...ungroupedResults.map(toEligibilityNode),
  ];

  if (topLevelNodes.length === 0) {
    return buildResult(
      'REVIEW_REQUIRED',
      groupResults,
      ungroupedResults,
      informationalRules,
      feature,
      []
    );
  }

  const combined = combine('AND', topLevelNodes);
  return buildResult(
    featureStatus(combined.status),
    groupResults,
    ungroupedResults,
    informationalRules,
    feature,
    combined.missingInputs
  );
}

export function evaluateRule(
  rule: AskFeatureRule,
  inputs: Readonly<Record<string, unknown>>,
  asOfDate: string
): AskRuleEvaluation {
  const inputCodes = rule.inputs.map(({ definition }) => definition.code);
  const missingInputs = deduplicateInputs(
    rule.inputs
      .filter(({ definition, required }) => required && !hasInput(inputs, definition.code))
      .map(({ definition }) => definition)
  );
  const informational = rule.ruleEffect.known && rule.ruleEffect.value === 'INFORMATIONAL';

  if (!isVerified(rule.verificationStatus) || !hasCurrentEvidence(rule.citations)) {
    return ruleResult(rule, inputCodes, [], 'NOT_EVALUATED', 'REVIEW_REQUIRED',
      `Rule ${rule.ruleKey} lacks safely current VERIFIED evidence.`);
  }
  if (!rule.ruleEffect.known) {
    return ruleResult(rule, inputCodes, [], 'NOT_EVALUATED', 'REVIEW_REQUIRED',
      `Unknown rule effect: ${rule.ruleEffect.raw}.`);
  }
  if (!rule.operator.known) {
    return ruleResult(rule, inputCodes, [], 'REVIEW_REQUIRED', 'REVIEW_REQUIRED',
      `Unknown rule operator: ${rule.operator.raw}.`);
  }

  if (rule.inputs.length !== 1) {
    const reason = `Rule ${rule.ruleKey} has ${rule.inputs.length} inputs and cannot be reduced to one operator operand.`;
    return ruleResult(
      rule,
      inputCodes,
      informational ? [] : missingInputs,
      'NOT_EVALUATED',
      informational ? 'INFORMATIONAL' : 'REVIEW_REQUIRED',
      reason
    );
  }

  const [{ definition, required }] = rule.inputs;
  if (!hasInput(inputs, definition.code)) {
    return ruleResult(
      rule,
      inputCodes,
      required && !informational ? [definition] : [],
      'UNKNOWN',
      informational ? 'INFORMATIONAL' : 'UNKNOWN',
      `Input ${definition.code} was not supplied.`
    );
  }

  const predicate = evaluateOperator(
    rule.operator,
    inputs[definition.code],
    rule.value,
    definition,
    asOfDate
  );
  if (predicate.status === 'REVIEW_REQUIRED') {
    return ruleResult(rule, inputCodes, [], predicate.status, 'REVIEW_REQUIRED', predicate.reason);
  }
  if (informational) {
    return ruleResult(rule, inputCodes, [], predicate.status, 'INFORMATIONAL', predicate.reason);
  }

  const predicateMatched = predicate.status === 'MATCH';
  const passes = rule.ruleEffect.value === 'MUST_MATCH' ? predicateMatched : !predicateMatched;
  return ruleResult(rule, inputCodes, [], predicate.status, passes ? 'PASS' : 'FAIL', null);
}

function evaluateGroup(
  groupId: string,
  groupsById: ReadonlyMap<string, EvaluateFeatureOptions['feature']['ruleGroups'][number]>,
  rulesById: ReadonlyMap<string, AskRuleEvaluation>,
  ancestors: ReadonlySet<string>
): AskGroupEvaluation {
  const group = groupsById.get(groupId);
  if (!group) return invalidGroup(groupId, 'Referenced rule group does not exist.');
  if (ancestors.has(groupId)) return invalidGroup(groupId, 'Rule-group cycle detected.', group);
  if (!group.operator.known) return invalidGroup(groupId, `Unknown group operator: ${group.operator.raw}.`, group);

  const nextAncestors = new Set(ancestors).add(groupId);
  const ruleResults: AskRuleEvaluation[] = [];
  const childGroupResults: AskGroupEvaluation[] = [];
  const nodes: EligibilityNode[] = [];

  for (const member of group.members) {
    if (member.ruleId) {
      const result = rulesById.get(member.ruleId);
      if (!result) {
        nodes.push({ missingInputs: [], status: 'REVIEW_REQUIRED' });
      } else {
        ruleResults.push(result);
        nodes.push(toEligibilityNode(result));
      }
    } else if (member.childGroupId) {
      const result = evaluateGroup(member.childGroupId, groupsById, rulesById, nextAncestors);
      childGroupResults.push(result);
      nodes.push(result);
    } else {
      nodes.push({ missingInputs: [], status: 'REVIEW_REQUIRED' });
    }
  }

  const combined = nodes.length > 0
    ? combine(group.operator.value, nodes)
    : { missingInputs: [], status: 'REVIEW_REQUIRED' as const };
  return { childGroupResults, group, missingInputs: combined.missingInputs, ruleResults, status: combined.status };
}

function combine(operator: RuleGroupOperator, nodes: readonly EligibilityNode[]): EligibilityNode {
  if (operator === 'AND') {
    if (nodes.some(({ status }) => status === 'FAIL')) return { missingInputs: [], status: 'FAIL' };
    if (nodes.every(({ status }) => status === 'PASS')) return { missingInputs: [], status: 'PASS' };
    if (nodes.some(({ status }) => status === 'REVIEW_REQUIRED')) {
      return { missingInputs: [], status: 'REVIEW_REQUIRED' };
    }
    return { missingInputs: deduplicateInputs(nodes.flatMap(({ missingInputs }) => missingInputs)), status: 'UNKNOWN' };
  }

  if (nodes.some(({ status }) => status === 'PASS')) return { missingInputs: [], status: 'PASS' };
  if (nodes.every(({ status }) => status === 'FAIL')) return { missingInputs: [], status: 'FAIL' };
  if (nodes.some(({ status }) => status === 'REVIEW_REQUIRED')) {
    return { missingInputs: [], status: 'REVIEW_REQUIRED' };
  }
  return { missingInputs: deduplicateInputs(nodes.flatMap(({ missingInputs }) => missingInputs)), status: 'UNKNOWN' };
}

function toEligibilityNode(result: AskRuleEvaluation): EligibilityNode {
  switch (result.status) {
    case 'PASS':
    case 'FAIL':
    case 'REVIEW_REQUIRED':
    case 'UNKNOWN':
      return { missingInputs: result.missingInputs, status: result.status };
    case 'INFORMATIONAL':
      return { missingInputs: [], status: 'REVIEW_REQUIRED' };
  }
}

function featureStatus(status: EligibilityNodeStatus): FeatureEvaluationStatus {
  switch (status) {
    case 'PASS': return 'CONDITIONS_SATISFIED';
    case 'FAIL': return 'CONDITION_NOT_SATISFIED';
    case 'UNKNOWN': return 'INSUFFICIENT_INFORMATION';
    case 'REVIEW_REQUIRED': return 'REVIEW_REQUIRED';
  }
}

function buildResult(
  status: FeatureEvaluationStatus,
  groupResults: AskGroupEvaluation[],
  ruleResults: AskRuleEvaluation[],
  informationalRules: AskRuleEvaluation[],
  feature: EvaluateFeatureOptions['feature'],
  missingInputs: AskEvaluationInputDefinition[]
): AskFeatureEvaluation {
  return {
    feature,
    groupResults,
    informationalRules,
    limits: feature.limits.filter(({ verificationStatus }) => isVerified(verificationStatus)),
    missingInputs: deduplicateInputs(missingInputs),
    ruleResults,
    status,
  };
}

function isVerified(status: { known: boolean; value: string | null }): boolean {
  return status.known && status.value === 'VERIFIED';
}

function hasCurrentEvidence(citations: EvaluateFeatureOptions['feature']['citations']): boolean {
  return citations.length > 0 && citations.every(({ source }) =>
    source.sourceStatus.known && source.sourceStatus.value === 'VERIFIED_CURRENT'
  );
}

function hasInput(inputs: Readonly<Record<string, unknown>>, code: string): boolean {
  return Object.prototype.hasOwnProperty.call(inputs, code) && inputs[code] !== undefined;
}

function deduplicateInputs(inputs: readonly AskEvaluationInputDefinition[]): AskEvaluationInputDefinition[] {
  return [...new Map(inputs.map((input) => [input.code, input])).values()];
}

function ruleResult(
  rule: AskFeatureRule,
  inputCodes: string[],
  missingInputs: AskEvaluationInputDefinition[],
  predicateStatus: AskRuleEvaluation['predicateStatus'],
  status: AskRuleEvaluation['status'],
  reason: string | null
): AskRuleEvaluation {
  return { inputCodes, missingInputs, predicateStatus, reason, rule, status };
}

function invalidGroup(
  id: string,
  reason: string,
  group?: EvaluateFeatureOptions['feature']['ruleGroups'][number]
): AskGroupEvaluation {
  return {
    childGroupResults: [],
    group: group ?? {
      description: reason,
      id,
      members: [],
      operator: { known: false, raw: 'INVALID', value: null },
      parentGroupId: null,
    },
    missingInputs: [],
    ruleResults: [],
    status: 'REVIEW_REQUIRED',
  };
}
