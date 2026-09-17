import { getOwnedCards } from '@/lib/cards';
import { supabase } from '@/lib/supabase';

export type VerifiedCardBenefit = {
  cardId: string;
  cardName: string;
  cardSlug: string;
  categoryCode: string;
  categoryName: string;
  categorySortOrder: number | null;
  featureId: string;
  featureTypeCode: string;
  featureTypeName: string;
  issuerName: string;
  summary: string | null;
  verificationStatus: 'VERIFIED';
};

export type BenefitsWalletData = {
  benefits: VerifiedCardBenefit[];
  ownedCardCount: number;
};

type CategoryRow = {
  code: string;
  name: string;
  sort_order: number | null;
};

type FeatureTypeRow = {
  category: CategoryRow | CategoryRow[] | null;
  code: string;
  name: string;
};

type IssuerRow = {
  name: string;
};

type CardRow = {
  id: string;
  issuer: IssuerRow | IssuerRow[] | null;
  name: string;
  slug: string;
};

type CardVersionRow = {
  card: CardRow | CardRow[] | null;
  card_id: string;
  status: string;
};

type CardFeatureRow = {
  card_version: CardVersionRow | CardVersionRow[] | null;
  feature_type: FeatureTypeRow | FeatureTypeRow[] | null;
  id: string;
  summary: string | null;
  verification_status: string;
};

const featureSelection = `
  id,
  summary,
  verification_status,
  card_version:card_versions!card_features_card_version_id_fkey!inner (
    card_id,
    status,
    card:cards!card_versions_card_id_fkey!inner (
      id,
      name,
      slug,
      issuer:issuers!cards_issuer_id_fkey (
        name
      )
    )
  ),
  feature_type:feature_types!card_features_feature_type_id_fkey!inner (
    code,
    name,
    category:benefit_categories!feature_types_category_id_fkey!inner (
      code,
      name,
      sort_order
    )
  )
`;

export async function getBenefitsWallet(userId: string): Promise<BenefitsWalletData> {
  const ownedCards = await getOwnedCards(userId);

  if (ownedCards.length === 0) {
    return { benefits: [], ownedCardCount: 0 };
  }

  const { data, error } = await supabase
    .from('card_features')
    .select(featureSelection)
    .eq('verification_status', 'VERIFIED')
    .eq('card_version.status', 'CURRENT')
    .in(
      'card_version.card_id',
      ownedCards.map(({ id }) => id)
    );

  if (error) throw error;

  return {
    benefits: (data as CardFeatureRow[]).map(mapBenefitRow),
    ownedCardCount: ownedCards.length,
  };
}

function mapBenefitRow(row: CardFeatureRow): VerifiedCardBenefit {
  const cardVersion = firstRelatedRow(row.card_version);
  const card = firstRelatedRow(cardVersion?.card ?? null);
  const issuer = firstRelatedRow(card?.issuer ?? null);
  const featureType = firstRelatedRow(row.feature_type);
  const category = firstRelatedRow(featureType?.category ?? null);

  if (!cardVersion || !card || !issuer || !featureType || !category) {
    throw new Error(`Card feature ${row.id} is missing display metadata.`);
  }

  if (cardVersion.status !== 'CURRENT' || row.verification_status !== 'VERIFIED') {
    throw new Error(`Card feature ${row.id} does not satisfy wallet visibility requirements.`);
  }

  return {
    cardId: card.id,
    cardName: card.name,
    cardSlug: card.slug,
    categoryCode: category.code,
    categoryName: category.name,
    categorySortOrder: category.sort_order,
    featureId: row.id,
    featureTypeCode: featureType.code,
    featureTypeName: featureType.name,
    issuerName: issuer.name,
    summary: row.summary,
    verificationStatus: 'VERIFIED',
  };
}

function firstRelatedRow<Row>(value: Row | Row[] | null): Row | null {
  if (Array.isArray(value)) return value[0] ?? null;

  return value;
}
