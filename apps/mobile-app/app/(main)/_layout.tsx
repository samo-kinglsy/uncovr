import { Tabs } from 'expo-router';

import { colors } from '@/constants/theme';

export default function MainLayout() {
  return (
    <Tabs
      initialRouteName="ask-uncovr"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.warmOffWhite,
        tabBarStyle: {
          backgroundColor: colors.secondaryBlack,
          borderTopColor: colors.secondaryBlack,
        },
      }}>
      <Tabs.Screen name="ask-uncovr" options={{ title: 'Ask UNCOVR' }} />
      <Tabs.Screen name="benefits-wallet" options={{ title: 'Benefits' }} />
      <Tabs.Screen name="my-cards" options={{ title: 'My Wallet' }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
