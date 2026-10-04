// src/design/tokens.js
// Voice 2 design system — "Paper & Ink".
//
// One restrained system for both experiences:
// - Warm paper backgrounds, ink text, and ONE signal colour reserved for
//   Speak and the current selection, so the most important action is always
//   the most visible thing on screen.
// - Word categories (modified Fitzgerald Key) are shown as a coloured edge and
//   symbol well on Adult tiles, and as a soft tinted fill on Child tiles.
// - Suggestions use a dashed outline so they always read as suggestions,
//   never as part of the board.
//
// Text/background pairs used for content reach WCAG AA (4.5:1); this is
// enforced by src/__tests__/designTokens.test.js.
// Legacy screens (the familiar "Classic" board) keep using src/theme.js.

export const colorSchemes = {
  light: {
    paper: '#F5F2EC',      // app background
    card: '#FFFFFF',       // tiles, sheets, the message stage
    sunk: '#EDE8E0',       // secondary buttons, wells, inputs
    ink: '#151A2D',        // primary text
    inkSoft: '#4A4F66',    // secondary text (AA on paper, card and sunk)
    line: '#DED7CB',       // hairlines and tile borders
    lineStrong: '#857D70', // suggestion outlines, input borders, switch off (3:1 on paper, card, sunk)
    signal: '#2643D9',     // Speak, selection, links
    onSignal: '#FFFFFF',
    signalSoft: '#E3E7FB', // selected backgrounds
    danger: '#B42318',
    onDanger: '#FFFFFF',
    dangerSoft: '#FBE4E1',
    success: '#1F7A45',
    focus: '#D84315',      // scan / keyboard focus ring (distinct from signal)
    symbolPlate: null,     // pictures sit straight on the tile
    scrim: 'rgba(21,26,45,0.45)',
    statusBar: 'dark',
  },
  dark: {
    paper: '#12141C',
    card: '#1C1F2B',
    sunk: '#272B3A',
    ink: '#F2EFE9',
    inkSoft: '#B9B5AC',
    line: '#30354A',
    lineStrong: '#737A99',
    signal: '#9AAAFF',
    onSignal: '#0B1030',
    signalSoft: '#262E55',
    danger: '#FF9C92',
    onDanger: '#2A0703',
    dangerSoft: '#3D1B18',
    success: '#7CD3A0',
    focus: '#FF9100',
    symbolPlate: '#F2EFE9', // light plate behind black line-art pictures
    scrim: 'rgba(0,0,0,0.6)',
    statusBar: 'light',
  },
  highContrast: {
    paper: '#000000',
    card: '#000000',
    sunk: '#141414',
    ink: '#FFFFFF',
    inkSoft: '#FFE45C',
    line: '#FFD600',
    lineStrong: '#FFD600',
    signal: '#FFD600',
    onSignal: '#000000',
    signalSoft: '#333000',
    danger: '#FF7A7A',
    onDanger: '#000000',
    dangerSoft: '#330000',
    success: '#66FF8A',
    focus: '#00E5FF',
    symbolPlate: '#FFFFFF',
    scrim: 'rgba(0,0,0,0.85)',
    statusBar: 'light',
  },
};

// Category colours. `edge` is the accent (Adult tile edge and symbol well),
// `fill` the Child tile background. Ink text sits on every `fill`.
export const categoryColors = {
  light: {
    starter:   { edge: '#5468E0', fill: '#E2E6FF' },
    pronoun:   { edge: '#D9A400', fill: '#FFF0BF' },
    verb:      { edge: '#2E9D5B', fill: '#D7F1DF' },
    adjective: { edge: '#3D7DD8', fill: '#DCE9FB' },
    noun:      { edge: '#E07B2E', fill: '#FFE3CC' },
    social:    { edge: '#D45A94', fill: '#FBDDEB' },
    important: { edge: '#D23C30', fill: '#FFD9D4' },
    misc:      { edge: '#8A8F9E', fill: '#ECE9E3' },
    nav:       { edge: '#6B7190', fill: '#E9E5DE' },
  },
  dark: {
    starter:   { edge: '#8E9BFF', fill: '#232A55' },
    pronoun:   { edge: '#F2C94C', fill: '#3A3216' },
    verb:      { edge: '#5FD08C', fill: '#183326' },
    adjective: { edge: '#6FA8F2', fill: '#18283F' },
    noun:      { edge: '#F5A05E', fill: '#3B2614' },
    social:    { edge: '#F08DBB', fill: '#3A1B2B' },
    important: { edge: '#FF7F73', fill: '#3D1A17' },
    misc:      { edge: '#A3A8B8', fill: '#272A35' },
    nav:       { edge: '#A8ADC6', fill: '#252938' },
  },
  // High contrast drops colour fills entirely: black tiles, yellow borders,
  // category shown only as a small edge so the label stays maximally legible.
  highContrast: {
    starter:   { edge: '#8E9BFF', fill: '#000000' },
    pronoun:   { edge: '#FFD600', fill: '#000000' },
    verb:      { edge: '#66FF8A', fill: '#000000' },
    adjective: { edge: '#66BBFF', fill: '#000000' },
    noun:      { edge: '#FFB060', fill: '#000000' },
    social:    { edge: '#FF8AD0', fill: '#000000' },
    important: { edge: '#FF7A7A', fill: '#000000' },
    misc:      { edge: '#FFFFFF', fill: '#000000' },
    nav:       { edge: '#FFFFFF', fill: '#000000' },
  },
};

export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Child mode is rounder and slightly roomier; Adult mode tighter and calmer.
export const shape = {
  child: { tile: 22, control: 20, sheet: 28, chip: 999 },
  adult: { tile: 14, control: 14, sheet: 22, chip: 999 },
};

// Type scale (system font; no downloaded fonts, so nothing to license or
// load at startup). Sizes are multiplied by the user's board text size.
export const type = {
  message: { fontSize: 26, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  tile: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.3 },
};

// Touch targets: never below 48dp for communication controls (44 is the
// platform minimum; AAC users benefit from more).
export const touch = { min: 48, action: 56, comfortable: 64 };

export const motion = {
  press: 90,     // tile press feedback
  settle: 180,   // panels, chips appearing
  sheet: 240,
};

/** Resolve the colour scheme for a settings.theme value. */
export function getScheme(theme) {
  return colorSchemes[theme] || colorSchemes.light;
}

export function getCategoryColors(theme, category) {
  const set = categoryColors[theme] || categoryColors.light;
  return set[category] || set.misc;
}
