import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { isLoading, session } = useAuth();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!isLoading && !session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!isLoading && Boolean(session)}>
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}
