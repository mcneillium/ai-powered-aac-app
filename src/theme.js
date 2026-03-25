// src/theme.js
// Single source of truth for theming across the AAC app.
// Every screen MUST import from here — no inline palette objects.

// ── Branding constants ──
export const brand = {
  name: 'Voice',
  tagline: 'communication for everyone',
  primaryColor: '#2979FF',
  accentColor: '#448AFF',
  privacyPolicyUrl: 'https://paulmartinmcneill.com/commai/privacy-policy',
  supportEmail: 'support@paulmartinmcneill.com',
};

// ── Design tokens ──
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: '#2E2E3A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#2E2E3A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const palettes = {
  light: {
    background: '#FAFAFA',
    surface: '#F2F4F7',
    text: '#2E2E3A',
    textSecondary: '#6E6E82',
    border: '#DDD9D4',
    tabBarBg: '#FFFFFF',
    tabBarActive: '#2979FF',
    tabBarInactive: '#A0A0A0',
    cardBg: '#FFFFFF',
    primary: '#2979FF',
    primaryMuted: '#DCEAFF',
    danger: '#D97575',
    info: '#448AFF',
    success: '#6BBF90',
    warning: '#E8A070',
    inputBg: '#FFFFFF',
    inputBorder: '#DDD9D4',
    chipBg: '#EBF0F7',
    overlay: 'rgba(0,0,0,0.4)',
    accent: '#7C8FCC',
    buttonText: '#FFFFFF',
  },
  dark: {
    background: '#141420',
    surface: '#1C1C32',
    text: '#EAEAEF',
    textSecondary: '#A4A4B8',
    border: '#2E2E4E',
    tabBarBg: '#1C1C32',
    tabBarActive: '#5C9AFF',
    tabBarInactive: '#8A8A9E',
    cardBg: '#222240',
    primary: '#5C9AFF',
    primaryMuted: '#1E2A4A',
    danger: '#E08080',
    info: '#6EAAFF',
    success: '#7CC99A',
    warning: '#EBAA7A',
    inputBg: '#222240',
    inputBorder: '#3E3E5E',
    chipBg: '#2A2E4E',
    overlay: 'rgba(0,0,0,0.65)',
    accent: '#8E9ED4',
    buttonText: '#FFFFFF',
  },
  highContrast: {
    background: '#000000',
    surface: '#000000',
    text: '#FFD600',
    textSecondary: '#FFFFFF',
    border: '#FFD600',
    tabBarBg: '#000000',
    tabBarActive: '#FFD600',
    tabBarInactive: '#FFFFFF',
    cardBg: '#1A1A00',
    primary: '#FFD600',
    primaryMuted: '#333300',
    danger: '#FF6666',
    info: '#66BBFF',
    success: '#66FF66',
    warning: '#FFB74D',
    inputBg: '#1A1A00',
    inputBorder: '#FFD600',
    chipBg: '#333300',
    overlay: 'rgba(0,0,0,0.8)',
    accent: '#FFD600',
    buttonText: '#000000',
  },
};

/**
 * Get the palette for a given theme name.
 * Falls back to 'light' if the theme is unrecognized.
 */
export function getPalette(theme) {
  return palettes[theme] || palettes.light;
}
