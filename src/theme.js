// src/theme.js
// Single source of truth for theming across the AAC app.
// Filled colours (primary, danger, info, success, warning, accent) must reach
// WCAG AA (4.5:1) against buttonText — enforced by theme.test.js.
// Every screen MUST import from here — no inline palette objects.
//
// Visual direction "Soft Studio": a warm canvas, white rounded tiles that
// carry their Fitzgerald Key colour as a cap, one big Speak button, and a dark
// floating tab bar. Child and Adult experiences share every layout and button
// position; they differ only in fill, type, corner radius and symbols.

// ── Branding constants ──
export const brand = {
  name: 'Voice',
  tagline: 'communication for everyone',
  primaryColor: '#2979FF',
  accentColor: '#448AFF',
  privacyPolicyUrl: 'https://paulmartinmcneill.com/commai/privacy-policy',
  supportEmail: 'support@paulmartinmcneill.com',
};

// ── Type ──
// Embedded at build time by the expo-font config plugin (app.json), so they
// are available offline from the first frame. On Android a custom family has
// one weight per file, so bold text names the bold file instead of using
// fontWeight. Atkinson Hyperlegible (Braille Institute) is designed for low
// vision readers; Fredoka gives the Child experience a friendlier headline.
// Both are SIL Open Font License 1.1.
export const fonts = {
  regular: 'AtkinsonHyperlegible_400Regular',
  bold: 'AtkinsonHyperlegible_700Bold',
  display: 'Fredoka_600SemiBold',
  displayMedium: 'Fredoka_500Medium',
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
    shadowColor: '#1F2433',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: '#1F2433',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
};

export const palettes = {
  light: {
    background: '#F6F4EF',
    surface: '#EFECE5',
    text: '#1F2433',
    textSecondary: '#545A6B',
    border: '#DED9CF',
    tabBarBg: '#1F2433',
    tabBarActive: '#FFFFFF',
    tabBarInactive: '#C3C7D3',
    tabBarPill: '#2263E0',
    headerBg: '#F6F4EF',
    cardBg: '#FFFFFF',
    primary: '#2263E0',
    primaryMuted: '#E4ECFC',
    onPrimaryMuted: '#173A8A',
    danger: '#C62828',
    info: '#1565C0',
    success: '#2B7A3D',
    warning: '#A85200',
    inputBg: '#FFFFFF',
    inputBorder: '#CFC9BE',
    chipBg: '#E9EEFB',
    overlay: 'rgba(20,22,32,0.45)',
    accent: '#4F5BB0',
    buttonText: '#FFFFFF',
    focusRing: '#D84315',
    tileBg: '#FFFFFF',
    tileBorder: '#E7E2D8',
    emptySlot: '#D3CDC1',
  },
  dark: {
    background: '#12141C',
    surface: '#1A1D28',
    text: '#ECEDF2',
    textSecondary: '#A9ADBD',
    border: '#2B2F3D',
    tabBarBg: '#232736',
    tabBarActive: '#0E1020',
    tabBarInactive: '#A9ADBD',
    tabBarPill: '#7FB0FF',
    headerBg: '#12141C',
    cardBg: '#1D2130',
    primary: '#7FB0FF',
    primaryMuted: '#1F2A44',
    onPrimaryMuted: '#CFE0FF',
    danger: '#F09090',
    info: '#7FB8FF',
    success: '#7CC99A',
    warning: '#EBAA7A',
    inputBg: '#1D2130',
    inputBorder: '#3A3F52',
    chipBg: '#232A40',
    overlay: 'rgba(0,0,0,0.65)',
    accent: '#A3B0E6',
    buttonText: '#0E1020', // dark text: white failed contrast on every dark-theme accent
    focusRing: '#FF9100',
    tileBg: '#1D2130',
    tileBorder: '#2B2F3D',
    emptySlot: '#3A3F52',
  },
  highContrast: {
    background: '#000000',
    surface: '#000000',
    text: '#FFD600',
    textSecondary: '#FFFFFF',
    border: '#FFD600',
    tabBarBg: '#000000',
    tabBarActive: '#000000',
    tabBarInactive: '#FFFFFF',
    tabBarPill: '#FFD600',
    headerBg: '#000000',
    cardBg: '#1A1A00',
    primary: '#FFD600',
    primaryMuted: '#333300',
    onPrimaryMuted: '#FFD600',
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
    tileBg: '#000000',
    tileBorder: '#FFD600',
    emptySlot: '#666666',
  },
};

/**
 * Get the palette for a given theme name.
 * Falls back to 'light' if the theme is unrecognized.
 */
export function getPalette(theme) {
  return palettes[theme] || palettes.light;
}

// ── Fitzgerald Key colours ──
// cap: the colour bar on each tile (a non-text graphic, so at least 3:1
// against the tile, WCAG 1.4.11). tint: the Child experience's tile fill
// (body text on it stays at least 7:1).
export const fitzgerald = {
  light: {
    starter:   { cap: '#5A4FCF', tint: '#E8E5FB', name: 'Sentence starters' },
    pronoun:   { cap: '#A87A00', tint: '#FFF3C4', name: 'People and pronouns' },
    verb:      { cap: '#23874F', tint: '#DDF2E3', name: 'Actions' },
    adjective: { cap: '#2B72C9', tint: '#DEEBFB', name: 'Describing words' },
    noun:      { cap: '#C8601A', tint: '#FFE5CF', name: 'Things and places' },
    social:    { cap: '#C2407F', tint: '#FBE1ED', name: 'Social words' },
    important: { cap: '#D2342B', tint: '#FDE1DF', name: 'Important and no' },
    misc:      { cap: '#6B7080', tint: '#EDEDF1', name: 'Little words' },
  },
  dark: {
    starter:   { cap: '#A79FFF', tint: '#2A2748', name: 'Sentence starters' },
    pronoun:   { cap: '#F2CF4B', tint: '#3A3418', name: 'People and pronouns' },
    verb:      { cap: '#6FD39A', tint: '#1C3527', name: 'Actions' },
    adjective: { cap: '#7FB8FF', tint: '#1D2C44', name: 'Describing words' },
    noun:      { cap: '#FFAE6B', tint: '#3D2A1A', name: 'Things and places' },
    social:    { cap: '#F59AC6', tint: '#3C2131', name: 'Social words' },
    important: { cap: '#FF8A80', tint: '#3F1F1E', name: 'Important and no' },
    misc:      { cap: '#B5B9C8', tint: '#262A36', name: 'Little words' },
  },
  highContrast: {
    starter:   { cap: '#B3A8FF', tint: '#000000', name: 'Sentence starters' },
    pronoun:   { cap: '#FFD600', tint: '#000000', name: 'People and pronouns' },
    verb:      { cap: '#66FF66', tint: '#000000', name: 'Actions' },
    adjective: { cap: '#66BBFF', tint: '#000000', name: 'Describing words' },
    noun:      { cap: '#FFB74D', tint: '#000000', name: 'Things and places' },
    social:    { cap: '#FF80C0', tint: '#000000', name: 'Social words' },
    important: { cap: '#FF6666', tint: '#000000', name: 'Important and no' },
    misc:      { cap: '#FFFFFF', tint: '#000000', name: 'Little words' },
  },
};

// The vocabulary data stores the original pastel fill per button; map it (or
// the button's category) to a Fitzgerald key. Unknown colours fall back to
// the category, then to 'misc', so custom words always get a cap.
const FILL_TO_KEY = {
  '#E3F2FD': 'starter',
  '#FFF9C4': 'pronoun',
  '#C8E6C9': 'verb',
  '#BBDEFB': 'adjective',
  '#FFE0B2': 'noun',
  '#F8BBD0': 'social',
  '#FFCDD2': 'important',
  '#EEEEEE': 'misc',
};
const CATEGORY_TO_KEY = {
  pronoun: 'pronoun', verb: 'verb', adjective: 'adjective', noun: 'noun',
  social: 'social', important: 'important', misc: 'misc',
};

export function fitzKey(button) {
  if (!button) return 'misc';
  if (button.multiWord) return 'starter';
  const byFill = FILL_TO_KEY[String(button.color || '').toUpperCase()];
  if (byFill) return byFill;
  return CATEGORY_TO_KEY[button.category] || 'misc';
}

export function fitzColours(theme, button) {
  const set = fitzgerald[theme] || fitzgerald.light;
  return set[fitzKey(button)];
}

// ── Experiences ──
// Visual differences only. Nothing here changes how many columns the grid
// has, the order of words or where any button sits, so switching between
// Child and Adult never breaks a learned motor plan.
// Tile height is shared (TILE_HEIGHT) for the same reason: a picture or a
// different mode must never make a row taller and push the rows below down.
export const TILE_HEIGHT = 92;

export const experiences = {
  child: {
    id: 'child',
    label: 'Child',
    tileRadius: 22,
    tileFill: 'tint',
    capHeight: 6,
    labelSize: 19,
    symbolsByDefault: true,
    headlineFont: fonts.display,
    chipRadius: 18,
    speakLabel: 'Say it',
  },
  adult: {
    id: 'adult',
    label: 'Adult',
    tileRadius: 14,
    tileFill: 'plain',
    capHeight: 5,
    labelSize: 19,
    symbolsByDefault: false,
    headlineFont: fonts.bold,
    chipRadius: 12,
    speakLabel: 'Speak',
  },
};

export function getExperience(id) {
  return experiences[id] || experiences.adult;
}

/** Whether symbols show on tiles: an explicit setting wins over the mode default. */
export function symbolsOn(settings) {
  if (settings && typeof settings.showSymbols === 'boolean') return settings.showSymbols;
  return getExperience(settings && settings.experience).symbolsByDefault;
}
