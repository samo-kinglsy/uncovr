import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { borderRadii, colors, spacing, typography } from '@/constants/theme';
import {
  addOwnedCard,
  type CardCatalogItem,
  type CardUuid,
  getCardCatalogue,
  getOwnedCards,
  removeOwnedCard,
} from '@/lib/cards';
import { useAuth } from '@/providers/auth-provider';

type WalletCard = CardCatalogItem & {
  accentColor: string;
  backgroundColor: string;
  bank: string;
  benefitCount: number;
  displayNetwork: string;
};

const issuerPresentation: Record<
  string,
  { accentColor: string; backgroundColor: string; bank: string }
> = {
  rbc: { accentColor: '#4C8AC9', backgroundColor: '#12355B', bank: 'RBC' },
  td: { accentColor: '#57A773', backgroundColor: '#0F5132', bank: 'TD' },
  scotiabank: { accentColor: '#D75B63', backgroundColor: '#8C1821', bank: 'SCOTIA' },
  'american-express': { accentColor: '#6C8EBF', backgroundColor: '#1D3557', bank: 'AMEX' },
  'canadian-tire-bank': { accentColor: '#C53A42', backgroundColor: '#1C1C1E', bank: 'CTB' },
  cibc: { accentColor: '#B76280', backgroundColor: '#5B1A32', bank: 'CIBC' },
};

const mockBenefitCounts: Record<string, number> = {
  'rbc-avion-visa-infinite': 6,
  'td-aeroplan-visa-infinite': 5,
  'amex-cobalt': 4,
  'scotiabank-passport-visa-infinite': 6,
};

export default function MyCardsScreen() {
  const { session } = useAuth();
  const [cards, setCards] = useState<WalletCard[]>([]);
  const [ownedCards, setOwnedCards] = useState<WalletCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<CardUuid | null>(null);
  const [pendingRemovalId, setPendingRemovalId] = useState<CardUuid | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    Promise.all([getCardCatalogue(), getOwnedCards(userId)])
      .then(([catalogue, owned]) => {
        if (!isMounted) return;

        setCards(catalogue.map(toWalletCard));
        setOwnedCards(owned.map(toWalletCard));
      })
      .catch(() => {
        if (isMounted) setErrorMessage('We could not load your wallet. Try again.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const availableCards = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const ownedCardIds = new Set(ownedCards.map(({ id }) => id));

    return cards.filter(
      (card) =>
        !ownedCardIds.has(card.id) &&
        `${card.bank} ${card.issuerName} ${card.name} ${card.displayNetwork}`
          .toLowerCase()
          .includes(normalizedQuery)
    );
  }, [cards, ownedCards, searchQuery]);

  function toggleCard(cardId: CardUuid) {
    setPendingRemovalId(null);
    setSelectedCardId((currentId) => (currentId === cardId ? null : cardId));
  }

  async function addCard(card: WalletCard) {
    if (!userId || isSaving) return;

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await addOwnedCard(userId, card.id);
      setOwnedCards((currentCards) => [...currentCards, card]);
      setSearchQuery('');
      setSelectedCardId(null);
      setPendingRemovalId(null);
    } catch {
      setErrorMessage('We could not add that card. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function removeCard(cardId: CardUuid) {
    if (!userId || isSaving) return;

    setErrorMessage(null);
    setIsSaving(true);

    try {
      await removeOwnedCard(userId, cardId);
      setOwnedCards((currentCards) => currentCards.filter(({ id }) => id !== cardId));
      setPendingRemovalId(null);
      setSelectedCardId(null);
    } catch {
      setErrorMessage('We could not remove that card. Check your connection and try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
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

        <View style={styles.titleRow}>
          <Text style={styles.title}>My Wallet</Text>
          <View style={styles.cardCount}>
            <Text style={styles.cardCountText}>{ownedCards.length} added</Text>
          </View>
        </View>

        {errorMessage && (
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {errorMessage}
          </Text>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Cards</Text>
          <View style={styles.cardList}>
            {isLoading && (
              <View style={styles.emptyState}>
                <ActivityIndicator color={colors.gold} size="small" />
              </View>
            )}
            {!isLoading &&
              ownedCards.map((card, index) => (
                <OwnedCardRow
                  card={card}
                  disabled={isSaving}
                  expanded={selectedCardId === card.id}
                  key={card.id}
                  last={index === ownedCards.length - 1}
                  onCancelRemove={() => setPendingRemovalId(null)}
                  onConfirmRemove={() => void removeCard(card.id)}
                  onPress={() => toggleCard(card.id)}
                  onRequestRemove={() => setPendingRemovalId(card.id)}
                  removalPending={pendingRemovalId === card.id}
                />
              ))}
            {!isLoading && ownedCards.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No cards added yet.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.section, styles.addSection]}>
          <Text style={styles.sectionTitle}>Add another card</Text>
          <View style={styles.searchBox}>
            <Ionicons color={colors.secondaryBlack} name="search-outline" size={19} />
            <TextInput
              accessibilityLabel="Search available cards"
              autoCapitalize="none"
              onChangeText={setSearchQuery}
              placeholder="Search cards..."
              placeholderTextColor={colors.secondaryBlack}
              selectionColor={colors.gold}
              style={styles.searchInput}
              value={searchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={() => setSearchQuery('')}>
                <Ionicons color={colors.secondaryBlack} name="close-circle" size={18} />
              </Pressable>
            )}
          </View>

          <View style={styles.availableList}>
            {availableCards.map((card, index) => (
              <AvailableCardRow
                card={card}
                disabled={isSaving}
                key={card.id}
                last={index === availableCards.length - 1}
                onAdd={() => void addCard(card)}
              />
            ))}
            {availableCards.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons color={colors.gold} name="checkmark-circle-outline" size={24} />
                <Text style={styles.emptyStateText}>
                  {searchQuery ? 'No matching cards found.' : 'All available cards have been added.'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function OwnedCardRow({
  card,
  disabled,
  expanded,
  last,
  onCancelRemove,
  onConfirmRemove,
  onPress,
  onRequestRemove,
  removalPending,
}: {
  card: WalletCard;
  disabled: boolean;
  expanded: boolean;
  last: boolean;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  onPress: () => void;
  onRequestRemove: () => void;
  removalPending: boolean;
}) {
  return (
    <View style={!last && styles.rowBorder}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [styles.cardRow, pressed && styles.rowPressed]}>
        <CardThumbnail card={card} />
        <View style={styles.cardCopy}>
          <Text style={styles.cardName}>{card.name}</Text>
          <Text style={styles.cardNetwork}>{card.network}</Text>
        </View>
        <Ionicons
          color={colors.primaryBlack}
          name={expanded ? 'chevron-up' : 'chevron-forward'}
          size={18}
        />
      </Pressable>

      {expanded && (
        <View style={styles.cardDetails}>
          <View style={styles.managementRow}>
            <View style={styles.benefitMetric}>
              <Text numberOfLines={1} style={styles.detailLabel}>
                Benefits uncovered
              </Text>
              <Text style={styles.detailValue}>{card.benefitCount}</Text>
            </View>
            {!removalPending && (
              <Pressable
                accessibilityLabel={`Remove ${card.name}`}
                accessibilityRole="button"
                disabled={disabled}
                hitSlop={4}
                onPress={onRequestRemove}
                style={({ pressed }) => [styles.removeButton, pressed && styles.removeButtonPressed]}>
                <Ionicons color="#B42318" name="trash-outline" size={18} />
              </Pressable>
            )}
          </View>

          {removalPending && (
            <View style={styles.confirmation}>
              <Text style={styles.confirmationTitle}>Remove {card.name}?</Text>
              <Text style={styles.confirmationText}>
                Its mock benefits will no longer appear in your wallet.
              </Text>
              <View style={styles.confirmationActions}>
                <Pressable onPress={onCancelRemove} style={styles.cancelButton}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={onConfirmRemove} style={styles.confirmButton}>
                  <Text style={styles.confirmButtonText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function AvailableCardRow({
  card,
  disabled,
  last,
  onAdd,
}: {
  card: WalletCard;
  disabled: boolean;
  last: boolean;
  onAdd: () => void;
}) {
  return (
    <View style={[styles.cardRow, !last && styles.rowBorder]}>
      <CardThumbnail card={card} />
      <View style={styles.cardCopy}>
        <Text style={styles.cardName}>{card.name}</Text>
        <Text style={styles.cardNetwork}>{card.network}</Text>
      </View>
      <Pressable
        accessibilityLabel={`Add ${card.name}`}
        accessibilityRole="button"
        disabled={disabled}
        hitSlop={8}
        onPress={onAdd}
        style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}>
        <Ionicons color={colors.offWhite} name="add" size={22} />
      </Pressable>
    </View>
  );
}

function CardThumbnail({ card }: { card: WalletCard }) {
  return (
    <View style={[styles.thumbnail, { backgroundColor: card.backgroundColor }]}>
      <View style={[styles.thumbnailAccent, { backgroundColor: card.accentColor }]} />
      <Text style={styles.thumbnailBank}>{card.bank}</Text>
      <Text numberOfLines={1} style={styles.thumbnailNetwork}>
        {card.displayNetwork}
      </Text>
    </View>
  );
}

function toWalletCard(card: CardCatalogItem): WalletCard {
  const presentation = issuerPresentation[card.issuerSlug] ?? {
    accentColor: colors.gold,
    backgroundColor: colors.secondaryBlack,
    bank: card.issuerName.split(' ')[0].toUpperCase(),
  };

  return {
    ...card,
    ...presentation,
    benefitCount: mockBenefitCounts[card.slug] ?? 0,
    displayNetwork: [card.network, card.networkTier].filter(Boolean).join(' '),
  };
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
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.title,
  },
  cardCount: {
    borderColor: colors.gold,
    borderRadius: borderRadii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  cardCountText: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.medium,
    lineHeight: typography.lineHeights.caption,
  },
  section: {
    gap: spacing.sm,
  },
  addSection: {
    backgroundColor: colors.warmOffWhite,
    borderRadius: borderRadii.lg,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  cardList: {
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  errorText: {
    color: '#B42318',
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    textAlign: 'center',
  },
  cardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 84,
    padding: spacing.sm,
  },
  rowBorder: {
    borderBottomColor: colors.warmOffWhite,
    borderBottomWidth: 1,
  },
  rowPressed: {
    backgroundColor: colors.warmOffWhite,
  },
  thumbnail: {
    borderRadius: borderRadii.sm,
    height: 52,
    justifyContent: 'space-between',
    overflow: 'hidden',
    padding: spacing.sm,
    position: 'relative',
    width: 82,
  },
  thumbnailAccent: {
    borderRadius: borderRadii.full,
    height: 56,
    opacity: 0.3,
    position: 'absolute',
    right: -20,
    top: -22,
    width: 56,
  },
  thumbnailBank: {
    color: colors.offWhite,
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  thumbnailNetwork: {
    color: colors.offWhite,
    fontSize: 8,
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
  cardNetwork: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    opacity: 0.7,
  },
  cardDetails: {
    backgroundColor: colors.warmOffWhite,
    gap: spacing.md,
    padding: spacing.md,
  },
  managementRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  benefitMetric: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: spacing.sm,
  },
  detailLabel: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
    opacity: 0.7,
  },
  detailValue: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  removeButton: {
    alignItems: 'center',
    borderRadius: borderRadii.full,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  removeButtonPressed: {
    backgroundColor: colors.offWhite,
  },
  confirmation: {
    backgroundColor: colors.offWhite,
    borderColor: '#B42318',
    borderRadius: borderRadii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  confirmationTitle: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
  confirmationText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    lineHeight: typography.lineHeights.caption,
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    borderColor: colors.secondaryBlack,
    borderRadius: borderRadii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cancelButtonText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
  },
  confirmButton: {
    backgroundColor: '#B42318',
    borderRadius: borderRadii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  confirmButtonText: {
    color: colors.offWhite,
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.offWhite,
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
  availableList: {
    backgroundColor: colors.offWhite,
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryBlack,
    borderRadius: borderRadii.full,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  addButtonPressed: {
    backgroundColor: colors.gold,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyStateText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    textAlign: 'center',
  },
});
