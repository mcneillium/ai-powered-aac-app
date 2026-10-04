/* eslint-env jest */
// Run 2 coordinator fixes (content is artificial):
// - "Open camera" left an unhandled rejection when the permission request
//   itself failed; it now shows the permission note instead.
// - A long message on the Show screen was only shrunk on iOS; on Android it
//   could be cut off behind the buttons. It now scrolls.
import React from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

const mockRequest = jest.fn();
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: false, canAskAgain: true }, mockRequest],
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null, Ionicons: () => null }));
jest.mock('../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: { theme: 'light' }, loading: false }),
}));
jest.mock('../services/speechService', () => ({ speak: jest.fn(), buildSpeechOptions: () => ({}) }));
jest.mock('../services/aiBackend', () => ({ callAIBackend: jest.fn(), ENDPOINTS: {} }));
jest.mock('../services/imageFile', () => ({ readImageBase64: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../design/usePaper', () => {
  const { getScheme, shape } = jest.requireActual('../design/tokens');
  return { usePaper: () => ({ theme: 'light', mode: 'adult', c: getScheme('light'), r: shape.adult, scale: 1, reduceMotion: true }) };
});
jest.mock('../hooks/useOverlayScan', () => ({ useOverlayScan: () => null }));

const CameraScreen = require('../screens/CameraScreen').default;
const ShowMessage = require('../components/studio/ShowMessage').default;

test('a failing camera permission request shows the note instead of rejecting', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockRequest.mockRejectedValue(new Error('activity gone'));
  let r;
  await act(async () => { r = TestRenderer.create(<CameraScreen />); });
  const btn = r.root.find((n) => n.props.accessibilityLabel === 'Open camera' && typeof n.props.onPress === 'function');
  let err = null;
  await act(async () => { await btn.props.onPress().catch((e) => { err = e; }); });
  expect(err).toBeNull();
  expect(alert).toHaveBeenCalledWith('Camera permission needed', expect.any(String));
  r.unmount();
  alert.mockRestore();
  warn.mockRestore();
});

test('a long message on the Show screen scrolls instead of being cut off', () => {
  const long = Array.from({ length: 60 }, (_, i) => `plim${i}`).join(' ');
  let r;
  act(() => { r = TestRenderer.create(<ShowMessage visible text={long} onClose={() => {}} />); });
  const msg = r.root.findAllByType(Text).find((t) => t.props.children === long);
  let n = msg.parent;
  let inScroll = false;
  while (n) { if (n.type === ScrollView) { inScroll = true; break; } n = n.parent; }
  expect(inScroll).toBe(true);
  expect(msg.props.adjustsFontSizeToFit).toBeFalsy();
});
