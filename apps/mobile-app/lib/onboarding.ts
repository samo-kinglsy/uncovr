import { supabase } from '@/lib/supabase';
import { type CardUuid, saveOwnedCardIds } from '@/lib/cards';

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

export async function completeOnboarding(userId: string, selectedCardIds: CardUuid[]) {
  if (selectedCardIds.length === 0) {
    throw new Error('Select at least one card before completing onboarding.');
  }

  const profile = await getOrCreateOnboardingProfile(userId);

  if (!profile.provinceTerritory) {
    throw new Error('Select a province or territory before completing onboarding.');
  }

  await saveOwnedCardIds(userId, selectedCardIds);

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw error;
}
