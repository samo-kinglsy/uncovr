import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { borderRadii, colors, spacing, typography } from '@/constants/theme';
import { getAskEvidencePackage } from '@/lib/ask-uncovr/evidence';
import {
  addSuppliedInput,
  canStartPersonalizedCheck,
  convertFollowUpAnswer,
  getAdditionalDetails,
  getAnswerViewModel,
  getCardStatusViewModel,
  getFailedConditionDescriptions,
  getFeatureDisplay,
  getOfficialSources,
  getPersonalizedFollowUp,
  resetPersonalizedCheck,
  resetSuppliedInputs,
} from '@/lib/ask-uncovr/ui';
import type { AskFollowUpViewModel } from '@/lib/ask-uncovr/ui';
import type {
  AskEvidencePackage,
  AskEvaluatedFeatureEvidence,
  AskScenarioInputs,
} from '@/lib/ask-uncovr/types';
import { useAuth } from '@/providers/auth-provider';

const popularQuestions = [
  'Do I have rental car insurance?',
  'How does my travel medical insurance work?',
  'Can I finance a $500 purchase?',
  'Can I redeem my CT Money?',
];

export default function AskUncovrScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [draftQuestion, setDraftQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState<string | null>(null);
  const [submittedAsOfDate, setSubmittedAsOfDate] = useState<string | null>(null);
  const [suppliedInputs, setSuppliedInputs] = useState<AskScenarioInputs>(resetSuppliedInputs);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [personalizedCheckActive, setPersonalizedCheckActive] = useState(resetPersonalizedCheck);
  const [evidence, setEvidence] = useState<AskEvidencePackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const requestSequence = useRef(0);
  const mounted = useRef(true);
  const hasFocusedOnce = useRef(false);
  const userId = session?.user.id;
  const hasQuestion = draftQuestion.trim().length > 0;

  useEffect(() => () => {
    mounted.current = false;
    requestSequence.current += 1;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (hasFocusedOnce.current) {
        requestSequence.current += 1;
        setEvidence(null);
        setSubmittedQuestion(null);
        setSubmittedAsOfDate(null);
        setSuppliedInputs(resetSuppliedInputs());
        setFollowUpAnswer('');
        setFollowUpError(null);
        setPersonalizedCheckActive(resetPersonalizedCheck());
        setError(null);
        setIsLoading(false);
      } else {
        hasFocusedOnce.current = true;
      }

      return () => {
        requestSequence.current += 1;
      };
    }, [])
  );

  async function runScenario(
    question: string,
    asOfDate: string,
    inputs: AskScenarioInputs,
    newQuestion: boolean
  ) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || !userId) return;

    const requestId = ++requestSequence.current;
    Keyboard.dismiss();
    if (newQuestion) setDraftQuestion(trimmedQuestion);
    setSubmittedQuestion(trimmedQuestion);
    setSubmittedAsOfDate(asOfDate);
    setSuppliedInputs(inputs);
    setFollowUpAnswer('');
    setFollowUpError(null);
    setIsFocused(false);
    setEvidence(null);
    setError(null);
    setIsLoading(true);

    try {
      const result = await getAskEvidencePackage({
        asOfDate,
        question: trimmedQuestion,
        suppliedInputs: inputs,
        userId,
      });
      if (!mounted.current || requestId !== requestSequence.current) return;
      setEvidence(result);
    } catch {
      if (!mounted.current || requestId !== requestSequence.current) return;
      setError("We couldn't load your verified benefit information.");
    } finally {
      if (mounted.current && requestId === requestSequence.current) setIsLoading(false);
    }
  }

  function submitQuestion(question: string) {
    setPersonalizedCheckActive(resetPersonalizedCheck());
    void runScenario(question, localDateString(), resetSuppliedInputs(), true);
  }

  function submitFollowUp(followUp: AskFollowUpViewModel, rawValue: boolean | string) {
    if (!submittedQuestion || !submittedAsOfDate) return;
    const converted = convertFollowUpAnswer(followUp, rawValue);
    if (converted.error !== null) {
      setFollowUpError(converted.error);
      return;
    }
    const nextInputs = addSuppliedInput(
      suppliedInputs,
      followUp.definition.code,
      converted.value
    );
    void runScenario(submittedQuestion, submittedAsOfDate, nextInputs, false);
  }

  function restartScenario() {
    if (!submittedQuestion || !submittedAsOfDate) return;
    setPersonalizedCheckActive(resetPersonalizedCheck());
    void runScenario(submittedQuestion, submittedAsOfDate, resetSuppliedInputs(), false);
  }

  function editQuestion(value: string) {
    setDraftQuestion(value);
    if (submittedQuestion && value.trim() !== submittedQuestion) {
      requestSequence.current += 1;
      setSubmittedQuestion(null);
      setSubmittedAsOfDate(null);
      setSuppliedInputs(resetSuppliedInputs());
      setFollowUpAnswer('');
      setFollowUpError(null);
      setPersonalizedCheckActive(resetPersonalizedCheck());
      setEvidence(null);
      setError(null);
      setIsLoading(false);
    }
  }

  async function handleDevelopmentSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOut();
    if (mounted.current) setIsSigningOut(false);
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>UNC<Text style={styles.gold}>O</Text>VR</Text>
            <View style={styles.headerActions}>
              {__DEV__ && (
                <Pressable
                  accessibilityLabel="Development sign out"
                  accessibilityRole="button"
                  disabled={isSigningOut}
                  onPress={handleDevelopmentSignOut}
                  style={({ pressed }) => [styles.developmentSignOut, pressed && styles.pressed]}>
                  <Text style={styles.developmentLabel}>DEV</Text>
                  <Ionicons color={colors.primaryBlack} name="log-out-outline" size={18} />
                </Pressable>
              )}
              <Ionicons color={colors.primaryBlack} name="notifications-outline" size={22} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ask UNCOVR</Text>
            <View style={[styles.askCard, (isFocused || hasQuestion) && styles.askCardExpanded]}>
              <TextInput
                accessibilityLabel="Ask UNCOVR a question"
                editable={!isLoading}
                multiline
                onBlur={() => setIsFocused(false)}
                onChangeText={editQuestion}
                onFocus={() => setIsFocused(true)}
                placeholder="Ask a question..."
                placeholderTextColor={colors.secondaryBlack}
                selectionColor={colors.gold}
                style={[styles.questionInput, (isFocused || hasQuestion) && styles.questionInputExpanded]}
                textAlignVertical="top"
                value={draftQuestion}
              />
              {!hasQuestion && !isFocused && (
                <Text style={styles.askExample}>e.g. Do I have rental car insurance?</Text>
              )}
              <Pressable
                accessibilityLabel="Submit question"
                accessibilityRole="button"
                disabled={!hasQuestion || isLoading || !userId}
                hitSlop={8}
                onPress={() => submitQuestion(draftQuestion)}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!hasQuestion || isLoading || !userId) && styles.disabled,
                  pressed && styles.pressed,
                ]}>
                {isLoading
                  ? <ActivityIndicator color={colors.primaryBlack} size="small" />
                  : <Ionicons color={colors.primaryBlack} name="arrow-up" size={20} />}
              </Pressable>
            </View>
          </View>

          {!hasQuestion && !evidence && !isLoading && !error && (
            <PopularQuestions onSelect={submitQuestion} />
          )}

          {isLoading && submittedQuestion && (
            <MessageCard loading text="Checking your owned cards and verified benefit data…" />
          )}

          {error && submittedQuestion && (
            <MessageCard title="Ask UNCOVR unavailable" text={error}>
              <Pressable
                accessibilityRole="button"
                onPress={() => void runScenario(
                  submittedQuestion,
                  submittedAsOfDate ?? localDateString(),
                  suppliedInputs,
                  false
                )}
                style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                <Text style={styles.actionButtonText}>Try again</Text>
              </Pressable>
            </MessageCard>
          )}

          {evidence && submittedQuestion && (
            <AskResult
              evidence={evidence}
              followUpAnswer={followUpAnswer}
              followUpError={followUpError}
              hasSuppliedInputs={Object.keys(suppliedInputs).length > 0}
              personalizedCheckActive={personalizedCheckActive}
              onBeginPersonalizedCheck={() => setPersonalizedCheckActive(true)}
              onOpenWallet={() => router.push('/my-cards')}
              onRestart={restartScenario}
              onSubmitFollowUp={submitFollowUp}
              onUpdateFollowUpAnswer={(value) => {
                setFollowUpAnswer(value);
                setFollowUpError(null);
              }}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PopularQuestions({ onSelect }: { onSelect: (question: string) => void }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Popular questions</Text>
      <View style={styles.chipList}>
        {popularQuestions.map((question) => (
          <Pressable
            accessibilityRole="button"
            key={question}
            onPress={() => onSelect(question)}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
            <Text style={styles.chipText}>{question}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function AskResult({
  evidence,
  followUpAnswer,
  followUpError,
  hasSuppliedInputs,
  personalizedCheckActive,
  onBeginPersonalizedCheck,
  onOpenWallet,
  onRestart,
  onSubmitFollowUp,
  onUpdateFollowUpAnswer,
}: {
  evidence: AskEvidencePackage;
  followUpAnswer: string;
  followUpError: string | null;
  hasSuppliedInputs: boolean;
  personalizedCheckActive: boolean;
  onBeginPersonalizedCheck: () => void;
  onOpenWallet: () => void;
  onRestart: () => void;
  onSubmitFollowUp: (followUp: AskFollowUpViewModel, value: boolean | string) => void;
  onUpdateFollowUpAnswer: (value: string) => void;
}) {
  const outcome = getAnswerViewModel(evidence);
  const followUp = getPersonalizedFollowUp(
    evidence.outcome,
    evidence.evaluatedFeatures,
    personalizedCheckActive
  );
  const canStartCheck = canStartPersonalizedCheck(
    evidence.outcome,
    evidence.evaluatedFeatures,
    personalizedCheckActive
  );
  const showCardStatuses = evidence.outcome === 'CONDITIONS_SATISFIED'
    || evidence.outcome === 'CONDITION_NOT_SATISFIED'
    || evidence.outcome === 'REVIEW_REQUIRED';

  return (
    <View style={styles.answer}>
      <View style={styles.answerStatus}>
        <View style={styles.answerStatusCopy}>
          <Text style={styles.answerEyebrow}>{outcome.eyebrow}</Text>
          <Text style={styles.answerTitle}>{outcome.title}</Text>
          <Text style={styles.answerIntro}>{outcome.body}</Text>
          {outcome.supportingText && (
            <Text style={styles.answerIntro}>{outcome.supportingText}</Text>
          )}
          {evidence.evaluatedFeatures.length > 0 && (
            <Text style={styles.answerTrust}>Based on verified card information</Text>
          )}
        </View>
        <Ionicons color={colors.gold} name="shield-checkmark-outline" size={44} />
      </View>

      {evidence.outcome === 'NO_OWNED_CARDS' && (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenWallet}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
          <Text style={styles.actionButtonText}>Open My Wallet</Text>
        </Pressable>
      )}

      {evidence.evaluatedFeatures.length > 0 && (
        <View style={styles.answerSection}>
          <Text style={styles.answerSectionTitle}>Your matching cards</Text>
          {evidence.evaluatedFeatures.map((feature) => (
            <FeatureResultCard
              feature={feature}
              key={feature.featureId}
              showStatus={showCardStatuses}
            />
          ))}
        </View>
      )}

      {canStartCheck && (
        <View style={styles.checkSituationCard}>
          <Text style={styles.noticeTitle}>Check your situation</Text>
          <Text style={styles.noticeText}>
            Answer a few questions to see how these conditions apply to your situation.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onBeginPersonalizedCheck}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <Text style={styles.actionButtonText}>Check my situation</Text>
          </Pressable>
        </View>
      )}

      {followUp && (
        <FollowUpCard
          answer={followUpAnswer}
          error={followUpError}
          followUp={followUp}
          onAnswer={(value) => onSubmitFollowUp(followUp, value)}
          onUpdateAnswer={onUpdateFollowUpAnswer}
        />
      )}

      {hasSuppliedInputs && (
        <Pressable
          accessibilityRole="button"
          onPress={onRestart}
          style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
          <Text style={styles.resetButtonText}>Start this scenario over</Text>
        </Pressable>
      )}

      {evidence.evaluatedFeatures.map((feature) => (
        <FeatureAdditionalInformation feature={feature} key={`additional-${feature.featureId}`} />
      ))}

      {evidence.cardsWithoutVerifiedData.length > 0 && (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Verified data not yet available</Text>
          <Text style={styles.noticeText}>
            UNCOVR does not yet have verified benefit data for: {' '}
            {evidence.cardsWithoutVerifiedData.map(({ name }) => name).join(', ')}.
          </Text>
        </View>
      )}

      {evidence.sourceWarnings.length > 0 && (
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeading}>
            <Ionicons color={colors.gold} name="alert-circle-outline" size={22} />
            <Text style={styles.noticeTitle}>Source review required</Text>
          </View>
          {evidence.sourceWarnings.map((warning) => (
            <Text key={warning.sourceId} style={styles.noticeText}>
              {warning.sourceTitle}: {warning.sourceStatus.replaceAll('_', ' ').toLowerCase()}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function FeatureAdditionalInformation({ feature }: { feature: AskEvaluatedFeatureEvidence }) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const details = getAdditionalDetails(feature);
  const sources = getOfficialSources(feature);

  if (details.length === 0 && sources.length === 0) return null;

  return (
    <View style={styles.additionalInformation}>
      <Text style={styles.additionalContext}>{feature.card.name}</Text>
      {details.length > 0 && (
        <View style={styles.disclosureSection}>
          <Pressable
            accessibilityLabel={`${detailsExpanded ? 'Hide' : 'Show'} more benefit details`}
            accessibilityRole="button"
            accessibilityState={{ expanded: detailsExpanded }}
            onPress={() => setDetailsExpanded((expanded) => !expanded)}
            style={({ pressed }) => [styles.disclosureButton, pressed && styles.pressed]}>
            <Text style={styles.disclosureTitle}>More details</Text>
            <Ionicons
              color={colors.primaryBlack}
              name={detailsExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
            />
          </Pressable>
          {detailsExpanded && (
            <View style={styles.disclosureContent}>
              {details.map((detail) => (
                <View key={detail} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{detail}</Text>
                </View>
              ))}
              <Text style={styles.noticeNote}>Not a complete list of terms.</Text>
            </View>
          )}
        </View>
      )}

      {sources.length > 0 && (
        <View style={styles.disclosureSection}>
          <Pressable
            accessibilityLabel={`${sourcesExpanded ? 'Hide' : 'Show'} official sources`}
            accessibilityRole="button"
            accessibilityState={{ expanded: sourcesExpanded }}
            onPress={() => setSourcesExpanded((expanded) => !expanded)}
            style={({ pressed }) => [styles.disclosureButton, pressed && styles.pressed]}>
            <Text style={styles.disclosureTitle}>Official sources</Text>
            <Ionicons
              color={colors.primaryBlack}
              name={sourcesExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
            />
          </Pressable>
          {sourcesExpanded && (
            <View style={styles.disclosureContent}>
              {sources.map((source) => source.clickable && source.url
                ? (
                    <Pressable
                      accessibilityLabel={`Open official source: ${source.title}`}
                      accessibilityRole="link"
                      key={source.id}
                      onPress={() => void Linking.openURL(source.url!).catch(() => undefined)}
                      style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}>
                      <Text style={[styles.sourceTitle, styles.sourceLinkTitle]}>{source.title}</Text>
                      <Ionicons color={colors.gold} name="open-outline" size={18} />
                    </Pressable>
                  )
                : (
                    <View key={source.id} style={styles.sourceRow}>
                      <Text style={styles.sourceTitle}>{source.title}</Text>
                    </View>
                  ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function FollowUpCard({ answer, error, followUp, onAnswer, onUpdateAnswer }: {
  answer: string;
  error: string | null;
  followUp: AskFollowUpViewModel;
  onAnswer: (value: boolean | string) => void;
  onUpdateAnswer: (value: string) => void;
}) {
  const numeric = followUp.control === 'currency' || followUp.control === 'number';
  const textControl = numeric || followUp.control === 'date';

  return (
    <View style={styles.followUpCard}>
      <View style={styles.noticeHeading}>
        <Ionicons color={colors.gold} name="help-circle-outline" size={22} />
        <Text style={styles.noticeTitle}>Check your situation</Text>
      </View>
      <Text style={styles.followUpPrompt}>{followUp.prompt}</Text>

      {followUp.control === 'boolean' && (
        <View style={styles.followUpActions}>
          {([['Yes', true], ['No', false]] as const).map(([label, value]) => (
            <Pressable
              accessibilityRole="button"
              key={label}
              onPress={() => onAnswer(value)}
              style={({ pressed }) => [styles.choiceButton, pressed && styles.pressed]}>
              <Text style={styles.choiceButtonText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {followUp.control === 'string-options' && (
        <View style={styles.optionList}>
          {followUp.options.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onAnswer(option.value)}
              style={({ pressed }) => [styles.optionButton, pressed && styles.pressed]}>
              <Text style={styles.optionButtonText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {textControl && (
        <>
          <TextInput
            accessibilityLabel={followUp.prompt}
            keyboardType={numeric ? 'decimal-pad' : 'numbers-and-punctuation'}
            onChangeText={onUpdateAnswer}
            placeholder={followUp.control === 'date' ? 'YYYY-MM-DD' : 'Enter a number'}
            placeholderTextColor={colors.secondaryBlack}
            style={styles.followUpInput}
            value={answer}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => onAnswer(answer)}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <Text style={styles.actionButtonText}>Continue</Text>
          </Pressable>
        </>
      )}

      {followUp.control === 'unsupported' && (
        <Text style={styles.noticeText}>
          UNCOVR cannot safely collect this detail with the available choices yet.
        </Text>
      )}
      {error && <Text style={styles.validationError}>{error}</Text>}
    </View>
  );
}

function FeatureResultCard({ feature, showStatus }: {
  feature: AskEvaluatedFeatureEvidence;
  showStatus: boolean;
}) {
  const display = getFeatureDisplay(feature);
  const status = getCardStatusViewModel(feature.evaluation.status);
  const failedConditions = getFailedConditionDescriptions(feature.evaluation);

  return (
    <View style={styles.featureCard}>
      <View style={styles.featureHeader}>
        <View style={styles.paymentCard}>
          <Text style={styles.paymentCardText}>{feature.card.issuerSlug.slice(0, 3).toUpperCase()}</Text>
        </View>
        <View style={styles.featureHeaderCopy}>
          <Text style={styles.cardName}>{feature.card.name}</Text>
          <Text style={styles.featureName}>{display.name}</Text>
        </View>
      </View>
      {showStatus && (
        <View style={styles.cardStatus}>
          <Text style={styles.cardStatusLabel}>{status.label}</Text>
          <Text style={styles.cardStatusMessage}>{status.message}</Text>
        </View>
      )}
      {display.importantItems.length > 0 && (
        <View style={styles.itemList}>
          <Text style={styles.itemListTitle}>Key conditions</Text>
          {display.importantItems.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.noticeNote}>Not the complete policy wording. Other terms may apply.</Text>
        </View>
      )}
      {failedConditions.length > 0 && (
        <View style={styles.itemList}>
          <Text style={styles.itemListTitle}>Condition not satisfied</Text>
          {failedConditions.map((condition) => (
            <View key={condition} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.bulletText}>{condition}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function MessageCard({ children, loading, text, title }: {
  children?: React.ReactNode;
  loading?: boolean;
  text: string;
  title?: string;
}) {
  return (
    <View style={styles.messageCard}>
      {loading
        ? <ActivityIndicator color={colors.gold} />
        : <Ionicons color={colors.gold} name="alert-circle-outline" size={28} />}
      {title && <Text style={styles.messageTitle}>{title}</Text>}
      <Text style={styles.messageText}>{text}</Text>
      {children}
    </View>
  );
}

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.offWhite, flex: 1 },
  keyboardView: { flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xl, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 40 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  wordmark: { color: colors.primaryBlack, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.semibold, letterSpacing: 1.5, lineHeight: typography.lineHeights.subtitle },
  gold: { color: colors.gold },
  developmentSignOut: { alignItems: 'center', borderColor: colors.warmOffWhite, borderRadius: borderRadii.full, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 36, paddingHorizontal: spacing.sm },
  developmentLabel: { color: colors.secondaryBlack, fontSize: 9, fontWeight: typography.weights.bold, letterSpacing: 0.5 },
  section: { gap: spacing.sm },
  sectionTitle: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.body },
  askCard: { backgroundColor: colors.offWhite, borderColor: colors.warmOffWhite, borderRadius: borderRadii.md, borderWidth: 1, minHeight: 64, paddingBottom: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, position: 'relative' },
  askCardExpanded: { minHeight: 132 },
  questionInput: { color: colors.secondaryBlack, flex: 1, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body, minHeight: 36, paddingBottom: 0, paddingHorizontal: 0, paddingTop: 0 },
  questionInputExpanded: { paddingBottom: spacing.xl },
  askExample: { bottom: spacing.sm, color: colors.secondaryBlack, fontSize: typography.sizes.caption, left: spacing.md, lineHeight: typography.lineHeights.caption, opacity: 0.6, position: 'absolute' },
  sendButton: { alignItems: 'center', backgroundColor: colors.gold, borderRadius: borderRadii.full, bottom: spacing.sm, height: 40, justifyContent: 'center', position: 'absolute', right: spacing.sm, width: 40 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  chipList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderColor: colors.gold, borderRadius: borderRadii.full, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { color: colors.primaryBlack, fontSize: typography.sizes.caption, fontWeight: typography.weights.medium, lineHeight: typography.lineHeights.caption },
  messageCard: { alignItems: 'center', backgroundColor: colors.warmOffWhite, borderRadius: borderRadii.lg, gap: spacing.sm, padding: spacing.lg },
  messageTitle: { color: colors.primaryBlack, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.semibold },
  messageText: { color: colors.secondaryBlack, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body, textAlign: 'center' },
  actionButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: colors.primaryBlack, borderRadius: borderRadii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionButtonText: { color: colors.gold, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
  answer: { gap: spacing.lg },
  submittedQuestion: { gap: spacing.xs },
  submittedLabel: { color: colors.secondaryBlack, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold, letterSpacing: 0.8 },
  submittedText: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.body },
  answerStatus: { alignItems: 'center', backgroundColor: colors.primaryBlack, borderRadius: borderRadii.lg, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  answerStatusCopy: { flex: 1, gap: spacing.xs },
  answerEyebrow: { color: colors.gold, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold, letterSpacing: 1, lineHeight: typography.lineHeights.caption },
  answerTitle: { color: colors.offWhite, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.bold, lineHeight: typography.lineHeights.subtitle },
  answerIntro: { color: colors.warmOffWhite, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  answerTrust: { color: colors.gold, fontSize: typography.sizes.caption, fontWeight: typography.weights.medium, lineHeight: typography.lineHeights.caption },
  answerSection: { gap: spacing.sm },
  answerSectionTitle: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.body },
  featureCard: { borderColor: colors.warmOffWhite, borderRadius: borderRadii.md, borderWidth: 1, gap: spacing.md, padding: spacing.md },
  featureHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  featureHeaderCopy: { flex: 1, gap: spacing.xs },
  paymentCard: { alignItems: 'center', backgroundColor: colors.primaryBlack, borderRadius: borderRadii.sm, height: 48, justifyContent: 'center', width: 68 },
  paymentCardText: { color: colors.gold, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold, letterSpacing: 0.5 },
  cardName: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.body },
  featureName: { color: colors.secondaryBlack, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  cardStatus: { backgroundColor: colors.warmOffWhite, borderRadius: borderRadii.sm, gap: spacing.xs, padding: spacing.sm },
  cardStatusLabel: { color: colors.primaryBlack, fontSize: typography.sizes.caption, fontWeight: typography.weights.bold, letterSpacing: 0.5 },
  cardStatusMessage: { color: colors.secondaryBlack, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  featureSummary: { color: colors.primaryBlack, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body },
  itemList: { gap: spacing.xs },
  itemListTitle: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
  bulletRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  bullet: { color: colors.gold, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body },
  bulletText: { color: colors.secondaryBlack, flex: 1, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body },
  noticeCard: { backgroundColor: colors.warmOffWhite, borderRadius: borderRadii.md, gap: spacing.sm, padding: spacing.md },
  noticeHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  noticeTitle: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
  noticeText: { color: colors.secondaryBlack, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body },
  noticeNote: { color: colors.secondaryBlack, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption, opacity: 0.75 },
  checkSituationCard: { backgroundColor: colors.warmOffWhite, borderRadius: borderRadii.md, gap: spacing.sm, padding: spacing.md },
  followUpCard: { backgroundColor: colors.warmOffWhite, borderColor: colors.gold, borderRadius: borderRadii.md, borderWidth: 1, gap: spacing.md, padding: spacing.md },
  followUpPrompt: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.body },
  followUpActions: { flexDirection: 'row', gap: spacing.sm },
  choiceButton: { alignItems: 'center', backgroundColor: colors.primaryBlack, borderRadius: borderRadii.full, flex: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  choiceButtonText: { color: colors.gold, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
  optionList: { gap: spacing.sm },
  optionButton: { borderColor: colors.gold, borderRadius: borderRadii.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  optionButtonText: { color: colors.primaryBlack, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body },
  followUpInput: { backgroundColor: colors.offWhite, borderColor: colors.gold, borderRadius: borderRadii.sm, borderWidth: 1, color: colors.primaryBlack, fontSize: typography.sizes.body, minHeight: 48, paddingHorizontal: spacing.md },
  validationError: { color: '#9F2F2F', fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  resetButton: { alignSelf: 'flex-start', borderBottomColor: colors.gold, borderBottomWidth: 1, paddingVertical: spacing.xs },
  resetButtonText: { color: colors.primaryBlack, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
  additionalInformation: { borderColor: colors.warmOffWhite, borderRadius: borderRadii.md, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  additionalContext: { color: colors.secondaryBlack, fontSize: typography.sizes.caption, fontWeight: typography.weights.semibold },
  disclosureSection: { borderTopColor: colors.warmOffWhite, borderTopWidth: 1 },
  disclosureButton: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingVertical: spacing.sm },
  disclosureTitle: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
  disclosureContent: { gap: spacing.sm, paddingBottom: spacing.sm },
  sourceRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between', minHeight: 44, paddingVertical: spacing.xs },
  sourceTitle: { color: colors.primaryBlack, flex: 1, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body },
  sourceLinkTitle: { textDecorationLine: 'underline' },
});
