import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { borderRadii, colors, spacing, typography } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Benefit = {
  id: string;
  name: string;
  summary: string;
  cards: string;
  detail: string;
  condition: string;
};

type BenefitCategory = {
  name: string;
  icon: IconName;
  benefits: Benefit[];
};

const benefitCategories: BenefitCategory[] = [
  {
    name: 'Travel',
    icon: 'airplane-outline',
    benefits: [
      {
        id: 'rental-car-insurance',
        name: 'Rental car insurance',
        summary: 'Collision damage and theft coverage',
        cards: 'RBC Avion + TD Aeroplan',
        detail: 'Coverage for eligible rental vehicles up to $65,000 MSRP for up to 48 days.',
        condition: 'Pay with an eligible card and decline the rental company’s CDW/LDW.',
      },
      {
        id: 'travel-medical-insurance',
        name: 'Travel medical insurance',
        summary: 'Emergency medical coverage abroad',
        cards: 'RBC Avion',
        detail: 'Emergency medical protection for eligible trips outside your home province.',
        condition: 'Coverage limits and trip-duration rules depend on the traveller’s age.',
      },
      {
        id: 'trip-cancellation',
        name: 'Trip cancellation',
        summary: 'Protection for eligible prepaid travel',
        cards: 'TD Aeroplan',
        detail: 'Reimbursement for qualifying non-refundable travel costs when a covered event occurs.',
        condition: 'The eligible trip expense must be charged to the covered card.',
      },
    ],
  },
  {
    name: 'Shopping',
    icon: 'bag-handle-outline',
    benefits: [
      {
        id: 'purchase-protection',
        name: 'Purchase protection',
        summary: 'Coverage for loss, theft, or damage',
        cards: 'RBC Avion + TD Aeroplan',
        detail: 'Eligible new purchases are protected against accidental loss, theft, or damage.',
        condition: 'The item must be purchased in full with an eligible card.',
      },
      {
        id: 'extended-warranty',
        name: 'Extended warranty',
        summary: 'Additional warranty protection',
        cards: 'RBC Avion',
        detail: 'The original manufacturer’s warranty may be doubled up to the policy maximum.',
        condition: 'Keep the original receipt and manufacturer warranty documentation.',
      },
      {
        id: 'mobile-device-insurance',
        name: 'Mobile device insurance',
        summary: 'Protection for eligible mobile devices',
        cards: 'TD Aeroplan',
        detail: 'Coverage may apply when an eligible device is lost, stolen, or accidentally damaged.',
        condition: 'Purchase the device or pay its monthly plan with the covered card.',
      },
    ],
  },
  {
    name: 'Lifestyle & perks',
    icon: 'sparkles-outline',
    benefits: [
      {
        id: 'airport-lounge-access',
        name: 'Airport lounge access',
        summary: 'Preferred airport lounge access',
        cards: 'RBC Avion',
        detail: 'Access participating airport lounges through the card’s eligible lounge program.',
        condition: 'Visit fees and guest access vary by lounge and membership status.',
      },
      {
        id: 'food-delivery-perks',
        name: 'Food delivery perks',
        summary: 'Eligible partner offers and credits',
        cards: 'TD Aeroplan',
        detail: 'Receive eligible promotional benefits from participating food delivery partners.',
        condition: 'Activation and qualifying purchases may be required.',
      },
      {
        id: 'concierge-service',
        name: 'Concierge service',
        summary: 'Premium lifestyle assistance',
        cards: 'RBC Avion',
        detail: 'Get assistance with dining, entertainment, travel planning, and special requests.',
        condition: 'Third-party purchases and bookings remain the cardholder’s responsibility.',
      },
    ],
  },
];

export default function BenefitsWalletScreen() {
  const [expandedBenefitId, setExpandedBenefitId] = useState<string | null>(null);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>
            UNC<Text style={styles.wordmarkAccent}>O</Text>VR
          </Text>
          <Ionicons color={colors.primaryBlack} name="notifications-outline" size={22} />
        </View>

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Benefits Wallet</Text>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryValue}>9 benefits</Text>
            <Text style={styles.summaryLabel}>across 2 cards</Text>
          </View>
          <Ionicons color={colors.gold} name="shield-checkmark-outline" size={48} />
        </View>

        <View style={styles.walletContent}>
          {benefitCategories.map((category) => (
            <BenefitCategorySection
              category={category}
              expandedBenefitId={expandedBenefitId}
              key={category.name}
              onToggle={(benefitId) =>
                setExpandedBenefitId((currentId) =>
                  currentId === benefitId ? null : benefitId
                )
              }
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BenefitCategorySection({
  category,
  expandedBenefitId,
  onToggle,
}: {
  category: BenefitCategory;
  expandedBenefitId: string | null;
  onToggle: (benefitId: string) => void;
}) {
  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <View style={styles.categoryTitleGroup}>
          <View style={styles.categoryIcon}>
            <Ionicons color={colors.gold} name={category.icon} size={21} />
          </View>
          <Text style={styles.categoryTitle}>{category.name}</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{category.benefits.length} benefits</Text>
        </View>
      </View>

      <View style={styles.categoryCard}>
        {category.benefits.map((benefit, index) => (
          <BenefitRow
            benefit={benefit}
            expanded={expandedBenefitId === benefit.id}
            key={benefit.id}
            last={index === category.benefits.length - 1}
            onPress={() => onToggle(benefit.id)}
          />
        ))}
      </View>
    </View>
  );
}

function BenefitRow({
  benefit,
  expanded,
  last,
  onPress,
}: {
  benefit: Benefit;
  expanded: boolean;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <View style={!last && styles.rowBorder}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={({ pressed }) => [styles.benefitRow, pressed && styles.rowPressed]}>
        <View style={styles.benefitCopy}>
          <Text style={styles.benefitName}>{benefit.name}</Text>
          <View style={styles.cardAttribution}>
            <Ionicons color={colors.gold} name="card-outline" size={14} />
            <Text style={styles.cardAttributionText}>{benefit.cards}</Text>
          </View>
        </View>
        <Ionicons
          color={colors.primaryBlack}
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
        />
      </Pressable>

      {expanded && (
        <View style={styles.benefitDetail}>
          <Text style={styles.benefitDetailSummary}>{benefit.summary}</Text>
          <Text style={styles.detailText}>{benefit.detail}</Text>
          <View style={styles.conditionRow}>
            <Ionicons color={colors.gold} name="alert-circle-outline" size={18} />
            <Text style={styles.conditionText}>{benefit.condition}</Text>
          </View>
          <View style={styles.sourceLink}>
            <Text style={styles.sourceLinkText}>View official coverage source</Text>
            <Ionicons color={colors.gold} name="open-outline" size={16} />
          </View>
        </View>
      )}
    </View>
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
  headingBlock: {
    paddingBottom: spacing.xs,
  },
  title: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.title,
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
  walletContent: {
    gap: spacing.lg,
  },
  categorySection: {
    gap: spacing.sm,
  },
  categoryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryTitleGroup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryIcon: {
    alignItems: 'center',
    backgroundColor: colors.warmOffWhite,
    borderRadius: borderRadii.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  categoryTitle: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.subtitle,
  },
  countPill: {
    borderColor: colors.gold,
    borderRadius: borderRadii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  countText: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.caption,
  },
  categoryCard: {
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rowBorder: {
    borderBottomColor: colors.warmOffWhite,
    borderBottomWidth: 1,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 72,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowPressed: {
    backgroundColor: colors.warmOffWhite,
  },
  benefitCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  benefitName: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  cardAttribution: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cardAttributionText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.caption,
  },
  benefitDetail: {
    backgroundColor: colors.warmOffWhite,
    gap: spacing.md,
    padding: spacing.md,
  },
  benefitDetailSummary: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  detailText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  conditionRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  conditionText: {
    color: colors.secondaryBlack,
    flex: 1,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
  sourceLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sourceLinkText: {
    color: colors.gold,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.caption,
    textDecorationLine: 'underline',
  },
});
