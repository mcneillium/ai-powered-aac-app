// src/components/tabBarMetrics.js
// The floating tab bar's footprint, so screens can keep their last row of
// content clear of it.
export const TAB_BAR_HEIGHT = 64;
export const TAB_BAR_MARGIN = 10;

/** Space the floating tab bar takes at the bottom of a screen. */
export function tabBarSpace(bottomInset = 0) {
  return TAB_BAR_HEIGHT + TAB_BAR_MARGIN + Math.max(bottomInset, 6);
}
