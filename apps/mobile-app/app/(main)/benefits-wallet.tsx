import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { type ComponentProps, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { borderRadii, colors, spacing, typography } from '@/constants/theme';
import { type BenefitsWalletData, getBenefitsWallet, type VerifiedCardBenefit } from '@/lib/benefits';
import { useAuth } from '@/providers/auth-provider';

type IconName = ComponentProps<typeof Ionicons>['name'];
type BenefitCategory = {
  benefits: VerifiedCardBenefit[];
  code: string;
  icon: IconName;
  name: string;
  sortOrder: number | null;
};

const categoryIcons: Record<string, IconName> = {
  financial_features: 'card-outline',
  insurance: 'shield-checkmark-outline',
  lifestyle_perks: 'sparkles-outline',
  protection: 'bag-handle-outline',
  rewards: 'gift-outline',
  travel_perks: 'airplane-outline',
};

export default function BenefitsWalletScreen() {
  const { session } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<BenefitsWalletData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadRequest, setReloadRequest] = useState(0);
  const userId = session?.user.id;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void reloadRequest;

      if (!userId) {
        setWallet({ benefits: [], ownedCardCount: 0 });
        setError(null);
        return () => { active = false; };
      }

      setError(null);
      getBenefitsWallet(userId)
        .then((data) => {
          if (!active) return;
          setWallet(data);
          setExpandedId(null);
        })
        .catch(() => {
          if (active) setError('We could not load your verified benefits. Check your connection and try again.');
        });
      return () => { active = false; };
    }, [reloadRequest, userId])
  );

  const categories = useMemo(() => groupBenefits(wallet?.benefits ?? []), [wallet]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>UNC<Text style={styles.gold}>O</Text>VR</Text>
          <Ionicons color={colors.primaryBlack} name="notifications-outline" size={22} />
        </View>
        <Text style={styles.title}>Benefits</Text>

        {!wallet && !error && <Message icon="hourglass-outline" text="Loading your verified benefits…" loading />}
        {error && (
          <Message icon="alert-circle-outline" text={error} title="Benefits unavailable">
            <Pressable onPress={() => setReloadRequest((value) => value + 1)} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </Message>
        )}

        {wallet && !error && (
          <>
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryValue}>{formatCount(wallet.benefits.length, 'benefit')}</Text>
                <Text style={styles.summaryLabel}>across {formatCount(wallet.ownedCardCount, 'card')}</Text>
              </View>
              <Ionicons color={colors.gold} name="shield-checkmark-outline" size={48} />
            </View>
            {categories.length ? (
              <View style={styles.walletContent}>
                {categories.map((category) => (
                  <CategorySection
                    category={category}
                    expandedId={expandedId}
                    key={category.code}
                    onToggle={(id) => setExpandedId((current) => current === id ? null : id)}
                  />
                ))}
              </View>
            ) : wallet.ownedCardCount ? (
              <Message icon="hourglass-outline" title="Verified data coming soon" text="Verified benefit data is not yet available for the cards in your wallet." />
            ) : (
              <Message icon="card-outline" title="Your wallet is empty" text="Add a card in My Wallet to discover its verified benefits." />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CategorySection({ category, expandedId, onToggle }: {
  category: BenefitCategory;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return <View style={styles.categorySection}>
    <View style={styles.categoryHeader}>
      <View style={styles.categoryTitleGroup}>
        <View style={styles.categoryIcon}><Ionicons color={colors.gold} name={category.icon} size={21} /></View>
        <Text style={styles.categoryTitle}>{category.name}</Text>
      </View>
      <View style={styles.countPill}><Text style={styles.countText}>{formatCount(category.benefits.length, 'benefit')}</Text></View>
    </View>
    <View style={styles.categoryCard}>
      {category.benefits.map((benefit, index) => (
        <BenefitRow benefit={benefit} expanded={expandedId === benefit.featureId} key={benefit.featureId}
          last={index === category.benefits.length - 1} onPress={() => onToggle(benefit.featureId)} />
      ))}
    </View>
  </View>;
}

function BenefitRow({ benefit, expanded, last, onPress }: {
  benefit: VerifiedCardBenefit;
  expanded: boolean;
  last: boolean;
  onPress: () => void;
}) {
  return <View style={!last && styles.rowBorder}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress}
      style={({ pressed }) => [styles.benefitRow, pressed && styles.rowPressed]}>
      <View style={styles.benefitCopy}>
        <Text style={styles.benefitName}>{benefit.displayName}</Text>
        <View style={styles.attribution}><Ionicons color={colors.gold} name="card-outline" size={14} />
          <Text style={styles.attributionText}>{benefit.cardName}</Text></View>
      </View>
      <Ionicons color={colors.primaryBlack} name={expanded ? 'chevron-up' : 'chevron-down'} size={18} />
    </Pressable>
    {expanded && <View style={styles.detail}>
      <Text style={styles.detailSummary}>{benefit.displaySummary ?? 'Verified benefit information is available for this card.'}</Text>
      {benefit.importantItems.length > 0 && (
        <View style={styles.importantItems}>
          <Text style={styles.importantItemsTitle}>Important conditions and limits</Text>
          <Text style={styles.importantItemsNote}>Not a complete list of terms.</Text>
          <View style={styles.importantItemsList}>
            {benefit.importantItems.map((item) => (
              <View key={item.id} style={styles.importantItem}>
                <Text style={styles.importantItemBullet}>{'\u2022'}</Text>
                <Text style={styles.importantItemText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      <View style={styles.attribution}><Ionicons color={colors.gold} name="checkmark-circle-outline" size={18} />
        <Text style={styles.attributionText}>Verified benefit information</Text></View>
    </View>}
  </View>;
}

function Message({ children, icon, loading, text, title }: {
  children?: React.ReactNode;
  icon: IconName;
  loading?: boolean;
  text: string;
  title?: string;
}) {
  return <View style={styles.messageCard}>
    {loading ? <ActivityIndicator color={colors.gold} /> : <Ionicons color={colors.gold} name={icon} size={30} />}
    {title && <Text style={styles.messageTitle}>{title}</Text>}
    <Text accessibilityLiveRegion="polite" style={styles.messageText}>{text}</Text>
    {children}
  </View>;
}

function groupBenefits(benefits: VerifiedCardBenefit[]) {
  const grouped = new Map<string, BenefitCategory>();
  for (const benefit of benefits) {
    const category = grouped.get(benefit.categoryCode);
    if (category) category.benefits.push(benefit);
    else grouped.set(benefit.categoryCode, {
      benefits: [benefit], code: benefit.categoryCode,
      icon: categoryIcons[benefit.categoryCode] ?? 'layers-outline',
      name: benefit.categoryName, sortOrder: benefit.categorySortOrder,
    });
  }
  return [...grouped.values()]
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name))
    .map((category) => ({ ...category, benefits: category.benefits.sort((a, b) =>
      a.displayName.localeCompare(b.displayName) || a.cardName.localeCompare(b.cardName)) }));
}

function formatCount(count: number, noun: string) { return `${count} ${noun}${count === 1 ? '' : 's'}`; }

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.offWhite, flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xl, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 40 },
  wordmark: { color: colors.primaryBlack, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.semibold, letterSpacing: 1.5 },
  gold: { color: colors.gold },
  title: { color: colors.primaryBlack, fontSize: typography.sizes.title, fontWeight: typography.weights.bold, lineHeight: typography.lineHeights.title },
  summaryCard: { alignItems: 'center', backgroundColor: colors.primaryBlack, borderRadius: borderRadii.lg, flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md },
  summaryValue: { color: colors.gold, fontSize: typography.sizes.title, fontWeight: typography.weights.bold },
  summaryLabel: { color: colors.offWhite, fontSize: typography.sizes.body },
  walletContent: { gap: spacing.lg },
  categorySection: { gap: spacing.sm },
  categoryHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  categoryTitleGroup: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  categoryIcon: { alignItems: 'center', backgroundColor: colors.warmOffWhite, borderRadius: borderRadii.full, height: 36, justifyContent: 'center', width: 36 },
  categoryTitle: { color: colors.primaryBlack, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.semibold },
  countPill: { borderColor: colors.gold, borderRadius: borderRadii.full, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  countText: { color: colors.primaryBlack, fontSize: typography.sizes.caption, fontWeight: typography.weights.medium },
  categoryCard: { borderColor: colors.warmOffWhite, borderRadius: borderRadii.lg, borderWidth: 1, overflow: 'hidden' },
  rowBorder: { borderBottomColor: colors.warmOffWhite, borderBottomWidth: 1 },
  benefitRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 72, padding: spacing.md },
  rowPressed: { backgroundColor: colors.warmOffWhite },
  benefitCopy: { flex: 1, gap: spacing.xs },
  benefitName: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
  attribution: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  attributionText: { color: colors.secondaryBlack, fontSize: typography.sizes.caption },
  detail: { backgroundColor: colors.warmOffWhite, gap: spacing.md, padding: spacing.md },
  detailSummary: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.body },
  importantItems: { gap: spacing.xs },
  importantItemsTitle: { color: colors.primaryBlack, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold, lineHeight: typography.lineHeights.body },
  importantItemsNote: { color: colors.secondaryBlack, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  importantItemsList: { gap: spacing.sm, paddingTop: spacing.xs },
  importantItem: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  importantItemBullet: { color: colors.gold, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body },
  importantItemText: { color: colors.secondaryBlack, flex: 1, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body },
  messageCard: { alignItems: 'center', backgroundColor: colors.warmOffWhite, borderRadius: borderRadii.lg, gap: spacing.sm, padding: spacing.lg },
  messageTitle: { color: colors.primaryBlack, fontSize: typography.sizes.subtitle, fontWeight: typography.weights.semibold },
  messageText: { color: colors.secondaryBlack, fontSize: typography.sizes.body, lineHeight: typography.lineHeights.body, textAlign: 'center' },
  retryButton: { backgroundColor: colors.primaryBlack, borderRadius: borderRadii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  retryText: { color: colors.gold, fontSize: typography.sizes.body, fontWeight: typography.weights.semibold },
});
