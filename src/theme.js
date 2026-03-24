// src/theme.js
// Single source of truth for theming across the AAC app.
// Every screen MUST import from here — no inline palette objects.

// ── Branding constants ──
export const brand = {
  name: 'Voice',
  tagline: 'communication for everyone',
  primaryColor: '#4AADA8',
  accentColor: '#6BB3D9',
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
    shadowColor: '#3A3A4A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#3A3A4A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const palettes = {
  light: {
    background: '#FAFAF8',
    surface: '#F4F2EF',
    text: '#2E2E3A',
    textSecondary: '#6E6E82',
    border: '#DDD9D4',
    tabBarBg: '#FAFAF8',
    tabBarActive: '#4AADA8',
    tabBarInactive: '#A0A0A0',
    cardBg: '#FFFFFF',
    primary: '#4AADA8',
    primaryMuted: '#D6EDEC',
    danger: '#D97575',
    info: '#6BB3D9',
    success: '#6BBF90',
    warning: '#E8A070',
    inputBg: '#FFFFFF',
    inputBorder: '#DDD9D4',
    chipBg: '#ECE9E5',
    overlay: 'rgba(0,0,0,0.4)',
    accent: '#B0A2CC',
    buttonText: '#FFFFFF',
  },
  dark: {
    background: '#181828',
    surface: '#1E1E36',
    text: '#EAEAEF',
    textSecondary: '#A4A4B8',
    border: '#2E2E4E',
    tabBarBg: '#1E1E36',
    tabBarActive: '#5BBFBA',
    tabBarInactive: '#8A8A9E',
    cardBg: '#222240',
    primary: '#5BBFBA',
    primaryMuted: '#2A3E3D',
    danger: '#E08080',
    info: '#7CBDE0',
    success: '#7CC99A',
    warning: '#EBAA7A',
    inputBg: '#222240',
    inputBorder: '#3E3E5E',
    chipBg: '#2E2E4E',
    overlay: 'rgba(0,0,0,0.65)',
    accent: '#B0A2CC',
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
