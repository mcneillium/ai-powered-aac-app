// Caregiver-configurable custom boards synced via Firebase.
// Local-first: boards are cached in AsyncStorage for offline use.
// Firebase onValue provides real-time updates when caregivers edit boards.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, onValue } from 'firebase/database';
import { db } from '../../firebaseConfig';
import { DB_PATHS, dbPath } from '../shared/schema';
import { getSymbolsForWords } from './symbolService';

const STORAGE_KEY = '@aac_custom_boards';
let boards = [];
let loaded = false;
let firebaseUnsub = null;
let onBoardsChangedCallback = null;

export async function loadCustomBoards() {
  if (loaded) return boards;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    boards = raw ? JSON.parse(raw) : [];
    loaded = true;
  } catch {
    boards = [];
    loaded = true;
  }
  return boards;
}

export function getCustomBoards() {
  return boards;
}

export function getCustomBoard(boardId) {
  return boards.find(b => b.id === boardId) || null;
}

export function onBoardsChanged(callback) {
  onBoardsChangedCallback = callback;
}

export function subscribeToFirebaseBoards(uid) {
  if (firebaseUnsub) firebaseUnsub();
  if (!uid) return;

  try {
    const boardsRef = ref(db, dbPath(DB_PATHS.CUSTOM_BOARDS, uid));
    firebaseUnsub = onValue(boardsRef, async (snapshot) => {
      if (snapshot.exists()) {
        const remote = snapshot.val();
        const newBoards = Object.entries(remote).map(([key, val]) => ({
          ...val,
          id: key,
        }));

        newBoards.sort((a, b) => (a.position || 0) - (b.position || 0));
        boards = newBoards;
        await saveBoards();

        for (const board of boards) {
          resolveSymbolsForBoard(board).catch(() => {});
        }

        if (onBoardsChangedCallback) onBoardsChangedCallback(boards);
      } else {
        boards = [];
        await saveBoards();
        if (onBoardsChangedCallback) onBoardsChangedCallback(boards);
      }
    }, () => {});
  } catch {}
}

async function resolveSymbolsForBoard(board) {
  if (!board.words || board.words.length === 0) return;
  try {
    const symbols = await getSymbolsForWords(board.words);
    board.resolvedSymbols = symbols;
    await saveBoards();
  } catch {}
}

async function saveBoards() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
  } catch {}
}

export function unsubscribeFromFirebaseBoards() {
  if (firebaseUnsub) { firebaseUnsub(); firebaseUnsub = null; }
}
