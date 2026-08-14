import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.primaryBlack },
        headerStyle: { backgroundColor: colors.primaryBlack },
        headerTintColor: colors.offWhite,
      }}>
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="create-account" options={{ title: 'Create account' }} />
    </Stack>
  );
}
