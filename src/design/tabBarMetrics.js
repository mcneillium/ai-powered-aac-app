// src/design/tabBarMetrics.js
// Size of the new board's bottom tab bar at any system font size.
//
// React Navigation's default bar is a fixed 49 dp plus the bottom inset. At a
// large system font the labels (12 px × font scale) no longer fit under the
// icon and ran into the Android gesture area (seen at font scale 2.0). The
// bar now grows with the label instead, so the label always sits fully above
// the gesture area; at normal sizes it is exactly the default height, so
// nothing moves for most users.
//
// Labels may grow up to LABEL_MAX_SCALE — the largest size at which a long
// tab name ("Personalise") still fits a quarter-width tab on a phone — and
// only shrink below that (never under LABEL_MIN_FIT, ≈16 px) as a last resort.

export const BASE_BAR_HEIGHT = 49; // React Navigation's default
export const LABEL_SIZE = 12;
export const LABEL_LINE = 1.25; // line height / font size
export const LABEL_MAX_SCALE = 1.6;
export const LABEL_MIN_FIT = 0.85;

const lineFor = (scale) => Math.ceil(LABEL_SIZE * LABEL_LINE * scale);

/**
 * @param {{ fontScale?: number, bottomInset?: number }} opts
 * @returns {{ height: number, paddingBottom: number, labelMaxMultiplier: number, labelLineHeight: number }}
 */
export function studioTabBarMetrics({ fontScale = 1, bottomInset = 0 } = {}) {
  const scale = Math.min(Math.max(fontScale || 1, 1), LABEL_MAX_SCALE);
  const extra = lineFor(scale) - lineFor(1);
  const inset = Math.max(0, bottomInset || 0);
  return {
    height: BASE_BAR_HEIGHT + extra + inset,
    paddingBottom: inset,
    labelMaxMultiplier: LABEL_MAX_SCALE,
    labelLineHeight: LABEL_SIZE * LABEL_LINE,
  };
}
