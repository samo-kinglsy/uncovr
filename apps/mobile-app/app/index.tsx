import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { borderRadii, colors, spacing, typography } from '@/constants/theme';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>UNCOVR</Text>
          <Text style={styles.subtitle}>Discover the benefits you already have.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primaryBlack,
    flex: 1,
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.secondaryBlack,
    borderRadius: borderRadii.xl,
    maxWidth: 420,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    width: '100%',
  },
  title: {
    color: colors.gold,
    fontSize: typography.sizes.display,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.display,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.warmOffWhite,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.regular,
    lineHeight: typography.lineHeights.subtitle,
    maxWidth: 300,
    textAlign: 'center',
  },
});
