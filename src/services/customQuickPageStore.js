// src/services/customQuickPageStore.js
// Local persistence for user-created Quick Pages.
// Same shape as built-in quickPageTemplates so they can be used interchangeably.
// Stored in AsyncStorage, survives app restarts.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@aac_custom_quick_pages';
const MAX_PAGES = 20;

let pages = [];
let loaded = false;

export async function loadCustomQuickPages() {
  if (loaded) return pages;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    pages = raw ? JSON.parse(raw) : [];
    loaded = true;
  } catch {
    pages = [];
    loaded = true;
  }
  return pages;
}

export function getCustomQuickPages() {
  return pages;
}

export async function saveCustomQuickPage(page) {
  // page: { id, label, icon, color, phrases: [{ id, label, category }] }
  if (!page || !page.id) return;
  const idx = pages.findIndex(p => p.id === page.id);
  if (idx >= 0) {
    pages[idx] = page; // update existing
  } else {
    if (pages.length >= MAX_PAGES) return; // cap
    pages.unshift(page); // add to front
  }
  await persist();
}

export async function deleteCustomQuickPage(id) {
  pages = pages.filter(p => p.id !== id);
  await persist();
}

async function persist() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  } catch (e) {
    console.warn('Failed to save custom quick pages:', e);
  }
}
