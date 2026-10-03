/* eslint-env jest */
// Regression (native Android 15 emulator, edge-to-edge): offline, the banner
// was drawn at y 0..68 under a 136px status bar, over the clock and icons, and
// its white text on #E8A070 was 2.2:1.
import React, { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../contexts/NetworkContext', () => ({ useNetwork: jest.fn() }));

const { useNetwork } = require('../contexts/NetworkContext');
const { default: OfflineBanner, BANNER_BACKGROUND, BANNER_TEXT } = require('../components/OfflineBanner');

const metrics = {
  frame: { x: 0, y: 0, width: 411, height: 914 },
  insets: { top: 52, left: 0, right: 0, bottom: 24 },
};

let seenInsets;
let mounts;
function Screen() {
  seenInsets = useSafeAreaInsets();
  const id = useRef(Math.random());
  useEffect(() => { mounts.push(id.current); }, []);
  return <Text>board</Text>;
}

function render() {
  return TestRenderer.create(
    <SafeAreaProvider initialMetrics={metrics}>
      <OfflineBanner>
        <Screen />
      </OfflineBanner>
    </SafeAreaProvider>
  );
}

const bannerOf = (r) => r.root.findAll((n) => n.props.accessibilityRole === 'alert' && n.props.style);
const flat = (style) => Object.assign({}, ...[].concat(style).flat(Infinity).filter(Boolean));

describe('OfflineBanner', () => {
  beforeEach(() => { seenInsets = null; mounts = []; });

  test('offline: banner sits below the status bar and screens do not pad for it again', () => {
    useNetwork.mockReturnValue({ isOnline: false });
    let r;
    act(() => { r = render(); });
    const banner = bannerOf(r);
    expect(banner.length).toBeGreaterThan(0);
    expect(flat(banner[0].props.style).paddingTop).toBe(52 + 4);
    expect(seenInsets.top).toBe(0);
    expect(seenInsets.bottom).toBe(24);
  });

  test('online: no banner and screens get the real insets', () => {
    useNetwork.mockReturnValue({ isOnline: true });
    let r;
    act(() => { r = render(); });
    expect(bannerOf(r)).toHaveLength(0);
    expect(seenInsets).toEqual(metrics.insets);
  });

  test('going offline and back does not remount the app (sentence is kept)', () => {
    useNetwork.mockReturnValue({ isOnline: true });
    let r;
    act(() => { r = render(); });
    useNetwork.mockReturnValue({ isOnline: false });
    act(() => { r.update(
      <SafeAreaProvider initialMetrics={metrics}><OfflineBanner><Screen /></OfflineBanner></SafeAreaProvider>
    ); });
    useNetwork.mockReturnValue({ isOnline: true });
    act(() => { r.update(
      <SafeAreaProvider initialMetrics={metrics}><OfflineBanner><Screen /></OfflineBanner></SafeAreaProvider>
    ); });
    expect(mounts).toHaveLength(1);
  });

  test('banner text meets WCAG AA contrast', () => {
    const lum = (hex) => [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
    const [hi, lo] = [lum(BANNER_TEXT), lum(BANNER_BACKGROUND)].sort((a, b) => b - a);
    expect((hi + 0.05) / (lo + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
