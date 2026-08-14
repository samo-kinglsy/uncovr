import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>
            UNC<Text style={styles.wordmarkAccent}>O</Text>VR
          </Text>
          <Ionicons color={colors.primaryBlack} name="notifications-outline" size={22} />
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>You have</Text>
            <Text style={styles.summaryValue}>9 benefits</Text>
            <Text style={styles.summaryLabel}>across 2 cards</Text>
          </View>
          <Ionicons color={colors.gold} name="shield-checkmark-outline" size={56} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ask UNCOVR</Text>
          <View style={styles.askCard}>
            <View style={styles.askCopy}>
              <Text style={styles.askPrompt}>Ask a question...</Text>
              <Text style={styles.askExample}>e.g. Do I have rental car insurance?</Text>
            </View>
            <Ionicons color={colors.gold} name="chevron-forward" size={20} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular questions</Text>
          <View style={styles.chipList}>
            {popularQuestions.map((question) => (
              <View key={question} style={styles.chip}>
                <Text style={styles.chipText}>{question}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse all benefits</Text>
          <View style={styles.benefitsCard}>
            {benefitCategories.map((category, index) => (
              <View
                key={category.label}
                style={[styles.benefitRow, index < benefitCategories.length - 1 && styles.rowBorder]}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.offWhite,
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
    alignItems: 'center',
    backgroundColor: colors.offWhite,
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  askCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  askPrompt: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  askExample: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    opacity: 0.6,
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
});
