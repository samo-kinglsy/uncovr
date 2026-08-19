import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';

export default function AppEntryRoute() {
  const { isLoading, onboardingCompleted, session } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  if (!session) return <Redirect href="/create-account" />;

  return <Redirect href={onboardingCompleted ? '/ask-uncovr' : '/province-territory'} />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.offWhite,
    flex: 1,
    justifyContent: 'center',
  },
});
