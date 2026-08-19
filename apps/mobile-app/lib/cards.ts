import { supabase } from '@/lib/supabase';

export type CardUuid = string;

export type CardCatalogItem = {
  id: CardUuid;
  imageUrl: string | null;
  issuerName: string;
  issuerSlug: string;
  name: string;
  network: string;
  networkTier: string | null;
  slug: string;
  status: string;
};

type IssuerRow = {
  name: string;
  slug: string;
};

type CardRow = {
  id: string;
  image_url: string | null;
  issuer: IssuerRow | IssuerRow[] | null;
  name: string;
  network: string;
  network_tier: string | null;
  slug: string;
  status: string;
};

type OwnedCardRow = {
  card: CardRow | CardRow[] | null;
};

const cardSelection = `
  id,
  name,
  slug,
  network,
  network_tier,
  image_url,
  status,
  issuer:issuers!cards_issuer_id_fkey (
    name,
    slug
  )
`;

export async function getCardCatalogue(): Promise<CardCatalogItem[]> {
  const { data, error } = await supabase
    .from('cards')
    .select(cardSelection)
    .eq('country_code', 'CA')
    .eq('card_type', 'personal')
    .eq('status', 'ACTIVE')
    .order('name');

  if (error) throw error;

  return (data as CardRow[]).map(mapCardRow);
}

export async function getOwnedCards(userId: string): Promise<CardCatalogItem[]> {
  const { data, error } = await supabase
    .from('user_cards')
    .select(`
      card:cards!user_cards_card_id_fkey (
        ${cardSelection}
      )
    `)
    .eq('user_id', userId);

  if (error) throw error;

  return (data as OwnedCardRow[])
    .map(({ card }) => firstRelatedRow(card))
    .filter((card): card is CardRow => card !== null)
    .map(mapCardRow);
}

export async function addOwnedCard(userId: string, cardId: CardUuid) {
  const { error } = await supabase.from('user_cards').insert({ card_id: cardId, user_id: userId });

  if (error) throw error;
}

export async function removeOwnedCard(userId: string, cardId: CardUuid) {
  const { error } = await supabase
    .from('user_cards')
    .delete()
    .eq('user_id', userId)
    .eq('card_id', cardId);

  if (error) throw error;
}

export async function saveOwnedCardIds(userId: string, selectedCardIds: CardUuid[]) {
  const ownedCards = await getOwnedCards(userId);
  const existingCardIds = ownedCards.map(({ id }) => id);
  const existingCardIdSet = new Set(existingCardIds);
  const selectedCardIdSet = new Set(selectedCardIds);
  const cardIdsToAdd = selectedCardIds.filter((cardId) => !existingCardIdSet.has(cardId));
  const cardIdsToRemove = existingCardIds.filter((cardId) => !selectedCardIdSet.has(cardId));

  if (cardIdsToAdd.length > 0) {
    const { error } = await supabase
      .from('user_cards')
      .insert(cardIdsToAdd.map((cardId) => ({ card_id: cardId, user_id: userId })));

    if (error) throw error;
  }

  if (cardIdsToRemove.length > 0) {
    const { error } = await supabase
      .from('user_cards')
      .delete()
      .eq('user_id', userId)
      .in('card_id', cardIdsToRemove);

    if (error) throw error;
  }
}

function mapCardRow(row: CardRow): CardCatalogItem {
  const issuer = firstRelatedRow(row.issuer);

  if (!issuer) {
    throw new Error(`Card ${row.id} is missing issuer metadata.`);
  }

  return {
    id: row.id,
    imageUrl: row.image_url,
    issuerName: issuer.name,
    issuerSlug: issuer.slug,
    name: row.name,
    network: row.network,
    networkTier: row.network_tier,
    slug: row.slug,
    status: row.status,
  };
}

function firstRelatedRow<Row>(value: Row | Row[] | null): Row | null {
  if (Array.isArray(value)) return value[0] ?? null;

  return value;
}
