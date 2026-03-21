// src/theme.js
// Single source of truth for theming across the AAC app.
// Every screen MUST import from here — no inline palette objects.

// ── Branding constants ──
export const brand = {
  name: 'CommAI',
  tagline: 'Communication for everyone',
  primaryColor: '#4CAF50',
  accentColor: '#2196F3',
};

export const palettes = {
  light: {
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
    tabBarBg: '#FFFFFF',
    tabBarActive: '#4CAF50',
    tabBarInactive: '#9E9E9E',
    cardBg: '#FFFFFF',
    primary: '#4CAF50',
    danger: '#F44336',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FF9800',
    inputBg: '#FFFFFF',
    inputBorder: '#CCCCCC',
    chipBg: '#E0E0E0',
    overlay: 'rgba(0,0,0,0.5)',
  },
  dark: {
    background: '#000000',
    surface: '#121212',
    text: '#FFFFFF',
    textSecondary: '#AAAAAA',
    border: '#333333',
    tabBarBg: '#121212',
    tabBarActive: '#4CAF50',
    tabBarInactive: '#9E9E9E',
    cardBg: '#1E1E1E',
    primary: '#4CAF50',
    danger: '#F44336',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FF9800',
    inputBg: '#1E1E1E',
    inputBorder: '#444444',
    chipBg: '#333333',
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
