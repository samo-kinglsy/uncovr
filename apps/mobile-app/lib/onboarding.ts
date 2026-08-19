import { supabase } from '@/lib/supabase';

export type OnboardingProfile = {
  provinceTerritory: string | null;
  onboardingCompleted: boolean;
};

export async function getOrCreateOnboardingProfile(
  userId: string
): Promise<OnboardingProfile> {
  const { error: createError } = await supabase
    .from('profiles')
    .upsert({ id: userId }, { ignoreDuplicates: true, onConflict: 'id' });

  if (createError) throw createError;

  const { data, error } = await supabase
    .from('profiles')
    .select('province_territory, onboarding_completed')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    provinceTerritory: data.province_territory,
    onboardingCompleted: data.onboarding_completed,
  };
}

export async function saveProvinceTerritory(userId: string, provinceTerritory: string) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      province_territory: provinceTerritory,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
}

export async function getSelectedCardIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_cards')
    .select('card_id')
    .eq('user_id', userId);

  if (error) throw error;

  return data.map(({ card_id }) => card_id);
}

export async function saveSelectedCardIds(userId: string, selectedCardIds: string[]) {
  const existingCardIds = await getSelectedCardIds(userId);
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

export async function completeOnboarding(userId: string, selectedCardIds: string[]) {
  if (selectedCardIds.length === 0) {
    throw new Error('Select at least one card before completing onboarding.');
  }

  const profile = await getOrCreateOnboardingProfile(userId);

  if (!profile.provinceTerritory) {
    throw new Error('Select a province or territory before completing onboarding.');
  }

  await saveSelectedCardIds(userId, selectedCardIds);

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}
