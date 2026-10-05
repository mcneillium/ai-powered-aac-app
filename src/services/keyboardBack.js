// src/services/keyboardBack.js
// Back closes the on-screen keyboard first, and only a second Back leaves the
// screen or closes the sheet — the normal Android behaviour.
//
// Without this, one Back while typing both hid the keyboard and navigated
// away (Settings, Personalise, Find a word, Type…), losing what was typed.
// Reproduced on an Android 15 emulator and on a Galaxy S24: the Back press
// reaches the app's navigation and every RN Modal's onRequestClose even
// though the keyboard is open.
//
// Android may hide the keyboard a moment before the app sees that Back
// press, so a keyboard that closed within GRACE_MS still counts as open.

import { Keyboard, BackHandler } from 'react-native';

export const GRACE_MS = 400;

let visible = false;
let hiddenAt = 0;
let listening = false;

function listen() {
  if (listening) return;
  listening = true;
  Keyboard.addListener('keyboardDidShow', () => { visible = true; });
  Keyboard.addListener('keyboardDidHide', () => { visible = false; hiddenAt = Date.now(); });
}

/** True while the keyboard is open, or for GRACE_MS after it closed. */
export function keyboardWasOpen(now = Date.now()) {
  listen();
  const open = visible || (typeof Keyboard.isVisible === 'function' && Keyboard.isVisible());
  return open || (hiddenAt > 0 && now - hiddenAt < GRACE_MS);
}

/**
 * Call on Back. Returns true (Back handled) when it only closed the keyboard.
 * The grace window is spent at once, so the next Back works normally.
 */
export function backClosesKeyboardFirst(now = Date.now()) {
  if (!keyboardWasOpen(now)) return false;
  Keyboard.dismiss();
  visible = false;
  hiddenAt = 0;
  return true;
}

/**
 * App-wide: register once after the navigation container mounts, so this
 * listener runs before React Navigation's (BackHandler calls the most
 * recently added listener first). Returns the subscription.
 */
export function installKeyboardBackGuard() {
  listen();
  return BackHandler.addEventListener('hardwareBackPress', () => backClosesKeyboardFirst());
}

/** For a Modal's onRequestClose: close only if Back did not just close the keyboard. */
export function closeUnlessTyping(onClose) {
  return () => {
    if (backClosesKeyboardFirst()) return;
    if (onClose) onClose();
  };
}

// Tests only.
export function _resetForTests() {
  visible = false;
  hiddenAt = 0;
}
