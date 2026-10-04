// src/design/usePaper.js
// The current design context: colour scheme, mode shape, text scale and the
// system reduced-motion preference, so components stay consistent.

import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';
import { getScheme, shape } from './tokens';

/** True when the system asks for reduced motion (iOS and Android). */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => { if (alive) setReduced(!!v); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduced;
}

export function usePaper() {
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const theme = settings.theme || 'light';
  const mode = settings.uiMode === 'child' ? 'child' : 'adult';
  return useMemo(() => ({
    theme,
    mode,
    c: getScheme(theme),
    r: shape[mode],
    scale: settings.textScale || 1,
    reduceMotion,
  }), [theme, mode, settings.textScale, reduceMotion]);
}
