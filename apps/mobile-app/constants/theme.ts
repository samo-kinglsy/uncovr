import { Platform } from 'react-native';

export const colors = {
  primaryBlack: '#0A0A0A',
  secondaryBlack: '#1C1C1E',
  gold: '#D4AF37',
  offWhite: '#F5F5F7',
  warmOffWhite: '#E6E2D6',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const typography = {
  sizes: {
    caption: 12,
    body: 16,
    subtitle: 18,
    title: 32,
    display: 40,
  },
  lineHeights: {
    caption: 16,
    body: 24,
    subtitle: 26,
    title: 40,
    display: 48,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

export const Colors = {
  light: {
    text: colors.primaryBlack,
    background: colors.offWhite,
    tint: colors.gold,
    icon: colors.secondaryBlack,
    tabIconDefault: colors.secondaryBlack,
    tabIconSelected: colors.gold,
  },
  dark: {
    text: colors.offWhite,
    background: colors.primaryBlack,
    tint: colors.gold,
    icon: colors.warmOffWhite,
    tabIconDefault: colors.warmOffWhite,
    tabIconSelected: colors.gold,
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
