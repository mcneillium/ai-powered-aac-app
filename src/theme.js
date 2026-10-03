// src/theme.js
// Single source of truth for theming across the AAC app.
// Filled colours (primary, danger, info, success, warning, accent) must reach
// WCAG AA (4.5:1) against buttonText — enforced by theme.test.js.
// Every screen MUST import from here — no inline palette objects.

import { colorSchemes } from './design/tokens';

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
    textSecondary: '#5C5C70',
    border: '#DDD9D4',
    tabBarBg: '#FFFFFF',
    tabBarActive: '#1A66E0',
    tabBarInactive: '#6E6E82',
    cardBg: '#FFFFFF',
    primary: '#1A66E0',
    primaryMuted: '#DCEAFF',
    danger: '#C62828',
    info: '#1565C0',
    success: '#2B7A3D',
    warning: '#A85200',
    inputBg: '#FFFFFF',
    inputBorder: '#DDD9D4',
    chipBg: '#EBF0F7',
    overlay: 'rgba(0,0,0,0.4)',
    accent: '#4F5BB0',
    buttonText: '#FFFFFF',
    focusRing: '#D84315',
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
    buttonText: '#0E1020', // dark text: white failed contrast on every dark-theme accent
    focusRing: '#FF9100',
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
    focusRing: '#00E5FF', // distinct from the yellow borders used everywhere
  },
};

/**
 * The legacy palette keys filled from the Voice 2 design tokens, so every
 * secondary screen (Settings, Find, Insights, Login…) takes on the new look
 * when the new board is in use, without rewriting each screen. Filled
 * colours stay AA against buttonText (tested in designTokens.test.js).
 */
function fromScheme(c) {
  return {
    background: c.paper,
    surface: c.sunk,
    text: c.ink,
    textSecondary: c.inkSoft,
    border: c.line,
    tabBarBg: c.card,
    tabBarActive: c.signal,
    tabBarInactive: c.inkSoft,
    cardBg: c.card,
    primary: c.signal,
    primaryMuted: c.signalSoft,
    danger: c.danger,
    info: c.signal,
    success: c.success,
    warning: c.danger,
    inputBg: c.card,
    inputBorder: c.lineStrong,
    chipBg: c.sunk,
    overlay: c.scrim,
    accent: c.signal,
    buttonText: c.onSignal,
    focusRing: c.focus,
  };
}
export const studioPalettes = {
  light: fromScheme(colorSchemes.light),
  dark: fromScheme(colorSchemes.dark),
  highContrast: fromScheme(colorSchemes.highContrast),
};

/**
 * Get the palette for a given theme name. With boardLayout 'studio' (the
 * Voice 2 board) the palette comes from the new design tokens; the Classic
 * board keeps its familiar colours. Falls back to 'light'.
 */
export function getPalette(theme, boardLayout) {
  if (boardLayout === 'studio') return studioPalettes[theme] || studioPalettes.light;
  return palettes[theme] || palettes.light;
}
