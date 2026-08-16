import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { borderRadii, colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

type Card = {
  id: string;
  issuer: string;
  name: string;
  thumbnailLabel: string;
  backgroundColor: string;
  accentColor: string;
};

const cards: Card[] = [
  {
    id: 'rbc-avion',
    issuer: 'Royal Bank of Canada',
    name: 'RBC Avion Visa Infinite',
    thumbnailLabel: 'VISA INFINITE',
    backgroundColor: '#12355B',
    accentColor: '#4C8AC9',
  },
  {
    id: 'td-aeroplan',
    issuer: 'TD Canada Trust',
    name: 'TD Aeroplan Visa Infinite',
    thumbnailLabel: 'VISA INFINITE',
    backgroundColor: '#0F5132',
    accentColor: '#57A773',
  },
  {
    id: 'scotiabank-passport',
    issuer: 'Scotiabank',
    name: 'Scotiabank Passport Visa Infinite',
    thumbnailLabel: 'VISA INFINITE',
    backgroundColor: '#8C1821',
    accentColor: '#D75B63',
  },
  {
    id: 'amex-cobalt',
    issuer: 'American Express',
    name: 'American Express Cobalt Card',
    thumbnailLabel: 'COBALT',
    backgroundColor: '#1D3557',
    accentColor: '#6C8EBF',
  },
];

export default function CreditCardsScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCards = cards.filter((card) => selectedCardIds.includes(card.id));
  const availableCards = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return cards.filter(
      (card) =>
        !selectedCardIds.includes(card.id) &&
        `${card.issuer} ${card.name}`.toLowerCase().includes(normalizedQuery)
    );
  }, [searchQuery, selectedCardIds]);

  function addCard(cardId: string) {
    setSelectedCardIds((currentIds) => [...currentIds, cardId]);
  }

  function removeCard(cardId: string) {
    setSelectedCardIds((currentIds) => currentIds.filter((id) => id !== cardId));
  }

  function viewBenefitsWallet() {
    completeOnboarding();
    router.replace('/ask-uncovr');
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.wordmark}>
            UNC<Text style={styles.wordmarkAccent}>O</Text>VR
          </Text>

          <View style={styles.headingBlock}>
            <Text style={styles.title}>Add your cards</Text>
            <Text style={styles.supportingText}>
              Search for the Canadian credit cards you own.
            </Text>
          </View>

          <View style={styles.searchBox}>
            <Ionicons color={colors.secondaryBlack} name="search-outline" size={19} />
            <TextInput
              accessibilityLabel="Search cards"
              autoCapitalize="none"
              onChangeText={setSearchQuery}
              placeholder="Search by card or issuer..."
              placeholderTextColor={colors.secondaryBlack}
              selectionColor={colors.gold}
              style={styles.searchInput}
              value={searchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable
                accessibilityLabel="Clear search"
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => setSearchQuery('')}>
                <Ionicons color={colors.secondaryBlack} name="close-circle" size={18} />
              </Pressable>
            )}
          </View>

          <View style={styles.selectedSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Selected cards</Text>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{selectedCards.length} selected</Text>
              </View>
            </View>
            {selectedCards.length > 0 ? (
              <View style={styles.cardList}>
                {selectedCards.map((card, index) => (
                  <CardRow
                    action="remove"
                    card={card}
                    key={card.id}
                    last={index === selectedCards.length - 1}
                    onPress={() => removeCard(card.id)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptySelected}>
                <Text style={styles.emptySelectedText}>No cards selected yet.</Text>
              </View>
            )}
          </View>

          <View style={styles.availableSection}>
            <Text style={styles.sectionTitle}>Popular cards</Text>
            {availableCards.length > 0 ? (
              <View style={styles.cardList}>
                {availableCards.map((card, index) => (
                  <CardRow
                    action="add"
                    card={card}
                    key={card.id}
                    last={index === availableCards.length - 1}
                    onPress={() => addCard(card.id)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyAvailable}>
                <Ionicons color={colors.gold} name="checkmark-circle-outline" size={22} />
                <Text style={styles.emptyAvailableText}>
                  {searchQuery ? 'No matching cards found.' : 'All cards have been selected.'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={selectedCards.length === 0}
            onPress={viewBenefitsWallet}
            style={({ pressed }) => [
              styles.primaryButton,
              selectedCards.length === 0 && styles.primaryButtonDisabled,
              pressed && selectedCards.length > 0 && styles.primaryButtonPressed,
            ]}>
            <Text style={styles.primaryButtonText}>Uncover my benefits</Text>
            <Ionicons color={colors.primaryBlack} name="arrow-forward" size={19} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function CardRow({
  action,
  card,
  last,
  onPress,
}: {
  action: 'add' | 'remove';
  card: Card;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[styles.cardRow, !last && styles.rowBorder]}>
      <CardThumbnail card={card} />
      <View style={styles.cardCopy}>
        <Text numberOfLines={2} style={styles.cardName}>
          {card.name}
        </Text>
        <Text style={styles.cardIssuer}>{card.issuer}</Text>
      </View>
      <Pressable
        accessibilityLabel={`${action === 'add' ? 'Add' : 'Remove'} ${card.name}`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowAction,
          action === 'remove' && styles.removeAction,
          pressed && styles.rowActionPressed,
        ]}>
        <Ionicons
          color={action === 'add' ? colors.offWhite : colors.secondaryBlack}
          name={action === 'add' ? 'add' : 'close'}
          size={21}
        />
      </Pressable>
    </View>
  );
}

function CardThumbnail({ card }: { card: Card }) {
  return (
    <View style={[styles.thumbnail, { backgroundColor: card.backgroundColor }]}>
      <View style={[styles.thumbnailAccent, { backgroundColor: card.accentColor }]} />
      <Text style={styles.thumbnailIssuer}>{card.issuer.split(' ')[0].toUpperCase()}</Text>
      <Text style={styles.thumbnailLabel}>{card.thumbnailLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.offWhite,
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
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
    gap: spacing.xs,
  },
  title: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.title,
  },
  supportingText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    opacity: 0.72,
  },
  searchBox: {
    alignItems: 'center',
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.primaryBlack,
    flex: 1,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    paddingVertical: spacing.sm,
  },
  selectedSection: {
    gap: spacing.sm,
  },
  availableSection: {
    backgroundColor: colors.warmOffWhite,
    borderRadius: borderRadii.lg,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
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
  cardList: {
    backgroundColor: colors.offWhite,
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 80,
    padding: spacing.sm,
  },
  rowBorder: {
    borderBottomColor: colors.warmOffWhite,
    borderBottomWidth: 1,
  },
  thumbnail: {
    borderRadius: borderRadii.sm,
    height: 50,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: spacing.sm,
    position: 'relative',
    width: 78,
  },
  thumbnailAccent: {
    borderRadius: borderRadii.full,
    height: 54,
    opacity: 0.3,
    position: 'absolute',
    right: -18,
    top: -22,
    width: 54,
  },
  thumbnailIssuer: {
    color: colors.offWhite,
    fontSize: 9,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.4,
  },
  thumbnailLabel: {
    color: colors.offWhite,
    fontSize: 7,
    opacity: 0.85,
  },
  cardCopy: {
    flex: 1,
  },
  cardName: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  cardIssuer: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    opacity: 0.7,
  },
  rowAction: {
    alignItems: 'center',
    backgroundColor: colors.primaryBlack,
    borderRadius: borderRadii.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  removeAction: {
    backgroundColor: colors.warmOffWhite,
  },
  rowActionPressed: {
    opacity: 0.7,
  },
  emptySelected: {
    alignItems: 'center',
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderStyle: 'dashed',
    borderWidth: 1,
    padding: spacing.md,
  },
  emptySelectedText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
  emptyAvailable: {
    alignItems: 'center',
    backgroundColor: colors.offWhite,
    borderRadius: borderRadii.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  emptyAvailableText: {
    color: colors.secondaryBlack,
    flex: 1,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  footer: {
    backgroundColor: colors.offWhite,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: borderRadii.full,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonDisabled: {
    opacity: 0.38,
  },
  primaryButtonPressed: {
    opacity: 0.78,
  },
  primaryButtonText: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
});
