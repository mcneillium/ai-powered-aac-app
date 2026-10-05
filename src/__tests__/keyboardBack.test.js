// Back closes the on-screen keyboard first; only a second Back leaves the
// screen or closes the sheet (S24 + emulator: one Back used to do both and
// lose what was typed).
import { Keyboard, BackHandler } from 'react-native';

let handlers;
let mod;

beforeEach(() => {
  jest.resetModules();
  handlers = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, fn) => {
    handlers[event] = fn;
    return { remove: jest.fn() };
  });
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  if (Keyboard.isVisible) jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  mod = require('../services/keyboardBack');
  mod._resetForTests();
  mod.keyboardWasOpen(); // start listening
});

afterEach(() => jest.restoreAllMocks());

test('Back with the keyboard open only closes the keyboard', () => {
  handlers.keyboardDidShow();
  expect(mod.backClosesKeyboardFirst()).toBe(true);
  expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  // The second Back is a normal Back.
  expect(mod.backClosesKeyboardFirst()).toBe(false);
});

test('a keyboard Android hid just before the Back still counts as open', () => {
  handlers.keyboardDidShow();
  handlers.keyboardDidHide();
  expect(mod.backClosesKeyboardFirst(Date.now() + 100)).toBe(true);
});

test('long after the keyboard closed, Back works normally', () => {
  handlers.keyboardDidShow();
  handlers.keyboardDidHide();
  expect(mod.backClosesKeyboardFirst(Date.now() + mod.GRACE_MS + 50)).toBe(false);
  expect(Keyboard.dismiss).not.toHaveBeenCalled();
});

test('with no keyboard, Back is never intercepted', () => {
  expect(mod.backClosesKeyboardFirst()).toBe(false);
});

test('a sheet stays open on the Back that closes the keyboard, and closes on the next', () => {
  const onClose = jest.fn();
  const requestClose = mod.closeUnlessTyping(onClose);
  handlers.keyboardDidShow();
  requestClose();
  expect(onClose).not.toHaveBeenCalled();
  requestClose();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('the app-wide guard handles Back (returns true) only while typing', () => {
  let listener;
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((event, fn) => {
    expect(event).toBe('hardwareBackPress');
    listener = fn;
    return { remove: jest.fn() };
  });
  mod.installKeyboardBackGuard();
  expect(listener()).toBe(false);
  handlers.keyboardDidShow();
  expect(listener()).toBe(true);
  expect(listener()).toBe(false);
});
