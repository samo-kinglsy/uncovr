import { Redirect, useLocalSearchParams } from 'expo-router';

export default function DevelopmentLaunchRoute() {
  const { onboardingComplete } = useLocalSearchParams<{ onboardingComplete?: string }>();

  // The query flag temporarily lets onboarding completion pass through `/` into the main app.
  return <Redirect href={onboardingComplete === 'true' ? '/ask-uncovr' : '/create-account'} />;
}
