// src/styles/theme.js
// Shared theme palettes and color constants used across all screens.

export const PALETTES = {
  light: {
    background: '#fff',
    text: '#000',
    tabBarBg: '#FFF',
    tabBarActive: '#4CAF50',
    tabBarInactive: 'gray',
  },
  dark: {
    background: '#000',
    text: '#fff',
    tabBarBg: '#121212',
    tabBarActive: '#4CAF50',
    tabBarInactive: 'gray',
  },
  highContrast: {
    background: '#000',
    text: '#FFD600',
    tabBarBg: '#000',
    tabBarActive: '#FFD600',
    tabBarInactive: 'white',
  },
};

export const COLORS = {
  primary: '#4CAF50',
  danger: '#f44336',
  info: '#2196F3',
  loadingBg: '#f5f5f5',
};

/**
 * Returns the palette for the given theme name.
 * @param {string} theme - One of 'light', 'dark', 'highContrast'.
 * @returns {Object} The palette object with background, text, etc.
 */
export function getPalette(theme) {
  return PALETTES[theme] || PALETTES.light;
}
