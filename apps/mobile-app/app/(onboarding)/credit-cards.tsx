import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { borderRadii, colors, spacing, typography } from '@/constants/theme';
import {
  type CardCatalogItem,
  type CardUuid,
  getCardCatalogue,
  getOwnedCards,
  saveOwnedCardIds,
} from '@/lib/cards';
import { completeOnboarding as persistCompletedOnboarding } from '@/lib/onboarding';
import { useAuth } from '@/providers/auth-provider';

const issuerArtwork: Record<string, { accentColor: string; backgroundColor: string }> = {
  rbc: { accentColor: '#4C8AC9', backgroundColor: '#12355B' },
  td: { accentColor: '#57A773', backgroundColor: '#0F5132' },
  scotiabank: { accentColor: '#D75B63', backgroundColor: '#8C1821' },
  'american-express': { accentColor: '#6C8EBF', backgroundColor: '#1D3557' },
  'canadian-tire-bank': { accentColor: '#C53A42', backgroundColor: '#1C1C1E' },
  cibc: { accentColor: '#B76280', backgroundColor: '#5B1A32' },
};

export default function CreditCardsScreen() {
  const router = useRouter();
  const { markOnboardingComplete, session } = useAuth();
  const [cards, setCards] = useState<CardCatalogItem[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<CardUuid[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    Promise.all([getCardCatalogue(), getOwnedCards(userId)])
      .then(([catalogue, ownedCards]) => {
        if (!isMounted) return;

        const catalogueIds = new Set(catalogue.map(({ id }) => id));
        setCards([...catalogue, ...ownedCards.filter(({ id }) => !catalogueIds.has(id))]);
        setSelectedCardIds(ownedCards.map(({ id }) => id));
      })
      .catch(() => {
        if (isMounted) setErrorMessage('We could not load your saved cards. Try again.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const selectedCards = cards.filter((card) => selectedCardIds.includes(card.id));
  const availableCards = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return cards.filter(
      (card) =>
        card.status === 'ACTIVE' &&
        !selectedCardIds.includes(card.id) &&
        `${card.issuerName} ${card.name}`.toLowerCase().includes(normalizedQuery)
    );
  }, [cards, searchQuery, selectedCardIds]);

  async function updateSelectedCards(nextCardIds: CardUuid[]) {
    if (!userId || isLoading || isSaving || isCompleting) return;

    const previousCardIds = selectedCardIds;
    setSelectedCardIds(nextCardIds);
    setErrorMessage(null);
    setIsSaving(true);

    try {
      await saveOwnedCardIds(userId, nextCardIds);
    } catch {
      setSelectedCardIds(previousCardIds);
      setErrorMessage('We could not save your cards. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function addCard(cardId: CardUuid) {
    void updateSelectedCards([...selectedCardIds, cardId]);
  }

  function removeCard(cardId: CardUuid) {
    void updateSelectedCards(selectedCardIds.filter((id) => id !== cardId));
  }

  async function uncoverBenefits() {
    if (!userId || selectedCardIds.length === 0 || isLoading || isSaving || isCompleting) return;

    setErrorMessage(null);
    setIsCompleting(true);

    try {
      await persistCompletedOnboarding(userId, selectedCardIds);
      markOnboardingComplete();
      router.replace('/ask-uncovr');
    } catch {
      setErrorMessage('We could not complete onboarding. Check your selections and try again.');
    } finally {
      setIsCompleting(false);
    }
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
            {isLoading ? (
              <View style={styles.loadingCards}>
                <ActivityIndicator color={colors.gold} size="small" />
              </View>
            ) : selectedCards.length > 0 ? (
              <View style={styles.cardList}>
                {selectedCards.map((card, index) => (
                  <CardRow
                    action="remove"
                    card={card}
                    key={card.id}
                    last={index === selectedCards.length - 1}
                    disabled={isSaving || isCompleting}
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
                    disabled={isLoading || isSaving || isCompleting}
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
          {errorMessage && (
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>
              {errorMessage}
            </Text>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={selectedCards.length === 0 || isLoading || isSaving || isCompleting}
            onPress={uncoverBenefits}
            style={({ pressed }) => [
              styles.primaryButton,
              (selectedCards.length === 0 || isLoading || isSaving || isCompleting) &&
                styles.primaryButtonDisabled,
              pressed &&
                selectedCards.length > 0 &&
                !isLoading &&
                !isSaving &&
                !isCompleting &&
                styles.primaryButtonPressed,
            ]}>
            {isCompleting ? (
              <>
                <ActivityIndicator color={colors.primaryBlack} size="small" />
                <Text style={styles.primaryButtonText}>Saving...</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Uncover my benefits</Text>
                <Ionicons color={colors.primaryBlack} name="arrow-forward" size={19} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function CardRow({
  action,
  card,
  disabled,
  last,
  onPress,
}: {
  action: 'add' | 'remove';
  card: CardCatalogItem;
  disabled: boolean;
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
        <Text style={styles.cardIssuer}>{card.issuerName}</Text>
      </View>
      <Pressable
        accessibilityLabel={`${action === 'add' ? 'Add' : 'Remove'} ${card.name}`}
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.rowAction,
          action === 'remove' && styles.removeAction,
          disabled && styles.rowActionDisabled,
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

function CardThumbnail({ card }: { card: CardCatalogItem }) {
  const artwork = issuerArtwork[card.issuerSlug] ?? {
    accentColor: colors.gold,
    backgroundColor: colors.secondaryBlack,
  };
  const networkLabel = [card.network, card.networkTier].filter(Boolean).join(' ').toUpperCase();

  return (
    <View style={[styles.thumbnail, { backgroundColor: artwork.backgroundColor }]}>
      <View style={[styles.thumbnailAccent, { backgroundColor: artwork.accentColor }]} />
      <Text style={styles.thumbnailIssuer}>{card.issuerName.split(' ')[0].toUpperCase()}</Text>
      <Text numberOfLines={1} style={styles.thumbnailLabel}>
        {networkLabel}
      </Text>
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
  loadingCards: {
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
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
  rowActionDisabled: {
    opacity: 0.45,
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
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  errorText: {
    color: '#B42318',
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    textAlign: 'center',
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
