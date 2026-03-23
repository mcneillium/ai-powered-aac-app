// src/theme.js
// Single source of truth for theming across the AAC app.
// Every screen MUST import from here — no inline palette objects.

// ── Branding constants ──
export const brand = {
  name: 'Voice',
  tagline: 'communication for everyone',
  primaryColor: '#5BB5B5',
  accentColor: '#7CB9E8',
  privacyPolicyUrl: 'https://paulmartinmcneill.com/commai/privacy-policy',
  supportEmail: 'support@paulmartinmcneill.com',
};

export const palettes = {
  light: {
    background: '#FFFFFF',
    surface: '#F8F6F3',
    text: '#3A3A4A',
    textSecondary: '#78788C',
    border: '#D4D0CC',
    tabBarBg: '#FFFFFF',
    tabBarActive: '#5BB5B5',
    tabBarInactive: '#9E9E9E',
    cardBg: '#FFFFFF',
    primary: '#5BB5B5',
    danger: '#E57373',
    info: '#7CB9E8',
    success: '#7DC89E',
    warning: '#F4A683',
    inputBg: '#FFFFFF',
    inputBorder: '#D4D0CC',
    chipBg: '#EAE7E3',
    overlay: 'rgba(0,0,0,0.5)',
  },
  dark: {
    background: '#1A1A2E',
    surface: '#16213E',
    text: '#E8E8EC',
    textSecondary: '#A0A0B4',
    border: '#2A2A4A',
    tabBarBg: '#16213E',
    tabBarActive: '#5BB5B5',
    tabBarInactive: '#9E9E9E',
    cardBg: '#1E1E3A',
    primary: '#5BB5B5',
    danger: '#E57373',
    info: '#7CB9E8',
    success: '#7DC89E',
    warning: '#F4A683',
    inputBg: '#1E1E3A',
    inputBorder: '#3A3A5A',
    chipBg: '#2A2A4A',
    overlay: 'rgba(0,0,0,0.7)',
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
    danger: '#FF6666',
    info: '#66BBFF',
    success: '#66FF66',
    warning: '#FFB74D',
    inputBg: '#1A1A00',
    inputBorder: '#FFD600',
    chipBg: '#333300',
    overlay: 'rgba(0,0,0,0.8)',
  },
};

/**
 * Get the palette for a given theme name.
 * Falls back to 'light' if the theme is unrecognized.
 */
export function getPalette(theme) {
  return palettes[theme] || palettes.light;
}
