import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { borderRadii, colors, spacing, typography } from '@/constants/theme';

const provincesAndTerritories = [
  'Alberta',
  'British Columbia',
  'Manitoba',
  'New Brunswick',
  'Newfoundland and Labrador',
  'Northwest Territories',
  'Nova Scotia',
  'Nunavut',
  'Ontario',
  'Prince Edward Island',
  'Quebec',
  'Saskatchewan',
  'Yukon',
];

export default function ProvinceTerritoryScreen() {
  const router = useRouter();
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.content}>
        <Text style={styles.wordmark}>
          UNC<Text style={styles.wordmarkAccent}>O</Text>VR
        </Text>

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Where do you live?</Text>
          <Text style={styles.supportingText}>
            Some benefits and coverage details vary by province or territory.
          </Text>
        </View>

        <Text style={styles.listLabel}>Select one</Text>
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={styles.listScroll}>
          <View style={styles.selectionList}>
            {provincesAndTerritories.map((region) => {
              const selected = selectedRegion === region;

              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={region}
                  onPress={() => setSelectedRegion(region)}
                  style={({ pressed }) => [
                    styles.selectionRow,
                    selected && styles.selectionRowSelected,
                    pressed && styles.selectionRowPressed,
                  ]}>
                  <Text style={[styles.regionName, selected && styles.regionNameSelected]}>
                    {region}
                  </Text>
                  <View style={[styles.selectionIndicator, selected && styles.indicatorSelected]}>
                    {selected && <Ionicons color={colors.primaryBlack} name="checkmark" size={16} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={!selectedRegion}
            onPress={() => router.push('/credit-cards')}
            style={({ pressed }) => [
              styles.continueButton,
              !selectedRegion && styles.continueButtonDisabled,
              pressed && selectedRegion && styles.continueButtonPressed,
            ]}>
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons color={colors.primaryBlack} name="arrow-forward" size={19} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.offWhite,
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  wordmark: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.subtitle,
    fontWeight: typography.weights.semibold,
    letterSpacing: 1.5,
    lineHeight: typography.lineHeights.subtitle,
  },
  wordmarkAccent: {
    color: colors.gold,
  },
  headingBlock: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.lg,
  },
  title: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.bold,
    lineHeight: typography.lineHeights.title,
  },
  supportingText: {
    color: colors.secondaryBlack,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    maxWidth: 360,
    opacity: 0.72,
  },
  listScroll: {
    flex: 1,
  },
  listLabel: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.md,
  },
  selectionList: {
    gap: spacing.sm,
  },
  selectionRow: {
    alignItems: 'center',
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 54,
    paddingHorizontal: spacing.md,
  },
  selectionRowSelected: {
    backgroundColor: colors.warmOffWhite,
    borderColor: colors.gold,
    borderWidth: 2,
  },
  selectionRowPressed: {
    opacity: 0.72,
  },
  regionName: {
    color: colors.secondaryBlack,
    flex: 1,
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
    paddingRight: spacing.md,
  },
  regionNameSelected: {
    color: colors.primaryBlack,
    fontWeight: typography.weights.semibold,
  },
  selectionIndicator: {
    alignItems: 'center',
    borderColor: colors.warmOffWhite,
    borderRadius: borderRadii.full,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  indicatorSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  footer: {
    backgroundColor: colors.offWhite,
    paddingBottom: spacing.sm,
    paddingTop: spacing.md,
  },
  continueButton: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: borderRadii.full,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
  },
  continueButtonDisabled: {
    opacity: 0.38,
  },
  continueButtonPressed: {
    opacity: 0.78,
  },
  continueButtonText: {
    color: colors.primaryBlack,
    fontSize: typography.sizes.body,
    fontWeight: typography.weights.semibold,
    lineHeight: typography.lineHeights.body,
  },
});
