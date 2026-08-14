import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
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

const popularQuestions = [
  'Rental car insurance',
  'Travel medical insurance',
  'Purchase protection',
  'Trip cancellation',
];

const benefitCategories = [
  { icon: 'airplane-outline', label: 'Travel', count: 4 },
  { icon: 'bag-handle-outline', label: 'Shopping', count: 3 },
  { icon: 'sparkles-outline', label: 'Lifestyle & perks', count: 2 },
] as const;

export default function AskUncovrScreen() {
  const [question, setQuestion] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const hasQuestion = question.trim().length > 0;

  function submitQuestion() {
    if (!hasQuestion) return;

    Keyboard.dismiss();
    setIsFocused(false);
    setShowAnswer(true);
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
            <Text style={styles.wordmark}>
              UNC<Text style={styles.wordmarkAccent}>O</Text>VR
            </Text>
            <Ionicons color={colors.primaryBlack} name="notifications-outline" size={22} />
          </View>

          {!isFocused && !hasQuestion && !showAnswer && (
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryLabel}>You have</Text>
                <Text style={styles.summaryValue}>9 benefits</Text>
                <Text style={styles.summaryLabel}>across 2 cards</Text>
              </View>
              <Ionicons color={colors.gold} name="shield-checkmark-outline" size={56} />
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ask UNCOVR</Text>
            <View style={[styles.askCard, (isFocused || hasQuestion) && styles.askCardExpanded]}>
              <TextInput
                accessibilityLabel="Ask UNCOVR a question"
                multiline
                onBlur={() => setIsFocused(false)}
                onChangeText={(value) => {
                  setQuestion(value);
                  setShowAnswer(false);
                }}
                onFocus={() => setIsFocused(true)}
                placeholder="Ask a question..."
                placeholderTextColor={colors.secondaryBlack}
                returnKeyType="default"
                selectionColor={colors.gold}
                style={[
                  styles.questionInput,
                  (isFocused || hasQuestion) && styles.questionInputExpanded,
                ]}
                textAlignVertical="top"
                value={question}
              />
              {!hasQuestion && !isFocused && (
                <Text style={styles.askExample}>e.g. Do I have rental car insurance?</Text>
              )}
              <Pressable
                accessibilityLabel="Submit question"
                accessibilityRole="button"
                disabled={!hasQuestion}
                hitSlop={8}
                onPress={submitQuestion}
                style={({ pressed }) => [
                  styles.sendButton,
                  !hasQuestion && styles.sendButtonDisabled,
                  pressed && hasQuestion && styles.sendButtonPressed,
                ]}>
                <Ionicons color={colors.primaryBlack} name="arrow-up" size={20} />
              </Pressable>
            </View>
          </View>

          {!hasQuestion && !showAnswer && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular questions</Text>
              <View style={styles.chipList}>
                {popularQuestions.map((suggestion) => (
                  <View key={suggestion} style={styles.chip}>
                    <Text style={styles.chipText}>{suggestion}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {showAnswer && <MockCoverageAnswer />}

          {!showAnswer && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Browse all benefits</Text>
              <View style={styles.benefitsCard}>
                {benefitCategories.map((category, index) => (
                  <View
                    key={category.label}
                    style={[
                      styles.benefitRow,
                      index < benefitCategories.length - 1 && styles.rowBorder,
                    ]}>
                    <View style={styles.categoryIcon}>
                      <Ionicons color={colors.gold} name={category.icon} size={21} />
                    </View>
                    <View style={styles.benefitCopy}>
                      <Text style={styles.benefitName}>{category.label}</Text>
                      <Text style={styles.benefitCount}>{category.count} benefits</Text>
                    </View>
                    <Ionicons color={colors.primaryBlack} name="chevron-forward" size={18} />
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MockCoverageAnswer() {
  return (
    <View style={styles.answer}>
      <View style={styles.answerStatus}>
        <View style={styles.answerStatusCopy}>
          <Text style={styles.answerEyebrow}>COVERAGE FOUND</Text>
          <Text style={styles.answerTitle}>Yes — you have coverage</Text>
          <Text style={styles.answerIntro}>
            Your eligible cards include rental vehicle damage and theft coverage.
          </Text>
        </View>
        <Ionicons color={colors.gold} name="shield-checkmark-outline" size={48} />
      </View>

      <View style={styles.answerSection}>
        <Text style={styles.answerSectionTitle}>Covered by 2 of your cards</Text>
        <View style={styles.coverageCard}>
          <View style={styles.paymentCard}>
            <Text style={styles.paymentCardText}>RBC</Text>
          </View>
          <View style={styles.coverageCardCopy}>
            <Text style={styles.coverageCardName}>RBC Avion Visa Infinite</Text>
            <Text style={styles.coverageCardDetail}>Rental vehicle damage & theft coverage</Text>
          </View>
          <Ionicons color={colors.gold} name="checkmark-circle" size={22} />
        </View>
        <View style={styles.coverageCard}>
          <View style={[styles.paymentCard, styles.paymentCardGreen]}>
            <Text style={styles.paymentCardText}>TD</Text>
          </View>
          <View style={styles.coverageCardCopy}>
            <Text style={styles.coverageCardName}>TD Aeroplan Visa Infinite</Text>
            <Text style={styles.coverageCardDetail}>Rental vehicle damage & theft coverage</Text>
          </View>
          <Ionicons color={colors.gold} name="checkmark-circle" size={22} />
        </View>
      </View>

      <View style={styles.answerSection}>
        <Text style={styles.answerSectionTitle}>Key coverage & eligibility</Text>
        <View style={styles.detailCard}>
          <CoverageDetail text="Pay for the rental in full with an eligible card." />
          <CoverageDetail text="Coverage applies for rentals up to 48 consecutive days." />
          <CoverageDetail text="Eligible rental vehicles are covered up to $65,000 MSRP." />
          <CoverageDetail text="Coverage includes qualifying collision damage and theft." />
        </View>
      </View>

      <View style={styles.conditionsCard}>
        <View style={styles.conditionsHeading}>
          <Ionicons color={colors.gold} name="alert-circle-outline" size={22} />
          <Text style={styles.conditionsTitle}>Important conditions</Text>
        </View>
        <Text style={styles.conditionsText}>• Decline the rental company&apos;s CDW/LDW.</Text>
        <Text style={styles.conditionsText}>• Coverage may be secondary to personal insurance.</Text>
        <Text style={styles.conditionsText}>• Vehicle and rental exclusions apply.</Text>
      </View>

      <View style={styles.answerSection}>
        <Text style={styles.answerSectionTitle}>Official sources</Text>
        <View style={styles.sourcesCard}>
          <SourceRow issuer="RBC Avion Visa Infinite" source="Certificate of Insurance (PDF)" />
          <View style={styles.sourceDivider} />
          <SourceRow issuer="TD Aeroplan Visa Infinite" source="Benefits Coverage Guide (PDF)" />
        </View>
      </View>
    </View>
  );
}

function CoverageDetail({ text }: { text: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons color={colors.gold} name="checkmark-circle-outline" size={19} />
      <Text style={styles.detailText}>{text}</Text>
    </View>
  );
}

function SourceRow({ issuer, source }: { issuer: string; source: string }) {
  return (
    <View accessibilityRole="link" style={styles.sourceRow}>
      <View style={styles.sourceCopy}>
        <Text style={styles.sourceIssuer}>{issuer}</Text>
        <Text style={styles.sourceName}>{source}</Text>
      </View>
      <Ionicons color={colors.gold} name="open-outline" size={20} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.offWhite,
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  wordmark: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.semibold,
    letterSpacing: 1.5,
    lineHeight: typography.lineHeights.subtitle,
  },
  wordmarkAccent: {
    color: colors.gold,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.primaryBlack,
    borderRadius: borderRadii.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  summaryLabel: {
    color: colors.offWhite,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  summaryValue: {
    color: colors.gold,
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.title,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  askCard: {
    backgroundColor: colors.offWhite,
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    minHeight: 64,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    position: 'relative',
  },
  askCardExpanded: {
    minHeight: 132,
  },
  questionInput: {
    color: colors.secondaryBlack,
    flex: 1,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    minHeight: 36,
    paddingBottom: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  questionInputExpanded: {
    paddingBottom: spacing.xl,
  },
  askExample: {
    bottom: spacing.sm,
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    left: spacing.md,
    lineHeight: typography.lineHeights.caption,
    opacity: 0.6,
    position: 'absolute',
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: borderRadii.full,
    bottom: spacing.sm,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.sm,
    width: 40,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonPressed: {
    opacity: 0.75,
  },
  chipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderColor: colors.gold,
    borderRadius: borderRadii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.caption,
  },
  benefitsCard: {
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 68,
    paddingHorizontal: spacing.md,
  },
  rowBorder: {
    borderBottomColor: colors.warmOffWhite,
    borderBottomWidth: 1,
  },
  categoryIcon: {
    alignItems: 'center',
    marginRight: spacing.md,
    width: 24,
  },
  benefitCopy: {
    flex: 1,
  },
  benefitName: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  benefitCount: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    opacity: 0.7,
  },
  answer: {
    gap: spacing.lg,
  },
  answerStatus: {
    alignItems: 'center',
    backgroundColor: colors.primaryBlack,
    borderRadius: borderRadii.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  answerStatusCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  answerEyebrow: {
    color: colors.gold,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    lineHeight: typography.lineHeights.caption,
  },
  answerTitle: {
    color: colors.offWhite,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.subtitle,
  },
  answerIntro: {
    color: colors.warmOffWhite,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
  answerSection: {
    gap: spacing.sm,
  },
  answerSectionTitle: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  coverageCard: {
    alignItems: 'center',
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 80,
    padding: spacing.sm,
  },
  paymentCard: {
    alignItems: 'center',
    backgroundColor: '#7A1018',
    borderRadius: borderRadii.sm,
    height: 48,
    justifyContent: 'center',
    width: 68,
  },
  paymentCardGreen: {
    backgroundColor: '#145C3A',
  },
  paymentCardText: {
    color: colors.offWhite,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  coverageCardCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  coverageCardName: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  coverageCardDetail: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    opacity: 0.7,
  },
  detailCard: {
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  detailRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailText: {
    color: colors.secondaryBlack,
    flex: 1,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  conditionsCard: {
    backgroundColor: colors.warmOffWhite,
    borderColor: colors.gold,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  conditionsHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  conditionsTitle: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  conditionsText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  sourcesCard: {
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sourceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 72,
    paddingHorizontal: spacing.md,
  },
  sourceCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  sourceIssuer: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  sourceName: {
    color: colors.gold,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    textDecorationLine: 'underline',
  },
  sourceDivider: {
    backgroundColor: colors.warmOffWhite,
    height: 1,
  },
});
