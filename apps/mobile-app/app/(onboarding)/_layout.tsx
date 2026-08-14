import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.primaryBlack },
        headerStyle: { backgroundColor: colors.primaryBlack },
        headerTintColor: colors.offWhite,
      }}>
      <Stack.Screen name="province-territory" options={{ title: 'Province or territory' }} />
      <Stack.Screen name="credit-cards" options={{ title: 'Credit cards' }} />
    </Stack>
  );
}
