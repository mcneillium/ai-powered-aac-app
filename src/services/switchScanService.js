// src/services/switchScanService.js
// Switch scanning service for users with motor disabilities.
//
// Supports two scanning modes:
// 1. AUTO-SCAN: Highlights items one by one on a timer. User presses a single
//    switch (mapped to spacebar or volume button) to select the current item.
// 2. STEP-SCAN: User presses one switch to move to the next item, and another
//    switch (or long-press) to select.
//
// Architecture:
// - The service manages scan state (current index, running, mode)
// - Screens register their scannable items via setScanItems()
// - The service emits events when selection changes or an item is activated
// - UI components listen via onScanChange and onScanSelect callbacks
//
// This service is intentionally decoupled from UI — it works with any
// FlatList, grid, or custom layout that provides an ordered item list.

let scanItems = [];
let currentIndex = -1;
let isRunning = false;
let scanMode = 'auto'; // 'auto' | 'step'
let scanSpeed = 1500; // ms between auto-scan steps
let timer = null;

let onChangeCallback = null;
let onSelectCallback = null;

export function setScanItems(items) {
  scanItems = items;
  currentIndex = -1;
}

export function setScanMode(mode) {
  scanMode = mode;
}

export function setScanSpeed(ms) {
  scanSpeed = Math.max(500, Math.min(5000, ms));
}

export function getScanState() {
  return {
    isRunning,
    currentIndex,
    scanMode,
    scanSpeed,
    itemCount: scanItems.length,
  };
}

export function onScanChange(callback) {
  onChangeCallback = callback;
}

export function onScanSelect(callback) {
  onSelectCallback = callback;
}

function emitChange() {
  if (onChangeCallback) {
    onChangeCallback({
      currentIndex,
      currentItem: scanItems[currentIndex] || null,
      isRunning,
    });
  }
}

function emitSelect() {
  if (onSelectCallback && currentIndex >= 0 && currentIndex < scanItems.length) {
    onSelectCallback({
      index: currentIndex,
      item: scanItems[currentIndex],
    });
  }
}

export function startScan() {
  if (scanItems.length === 0) return;
  isRunning = true;
  currentIndex = 0;
  emitChange();

  if (scanMode === 'auto') {
    clearInterval(timer);
    timer = setInterval(() => {
      advanceScan();
    }, scanSpeed);
  }
}

export function stopScan() {
  isRunning = false;
  currentIndex = -1;
  clearInterval(timer);
  timer = null;
  emitChange();
}

export function advanceScan() {
  if (!isRunning || scanItems.length === 0) return;
  currentIndex = (currentIndex + 1) % scanItems.length;
  emitChange();
}

export function selectCurrent() {
  if (!isRunning || currentIndex < 0) return;
  emitSelect();
}

// Handle hardware key events (spacebar, enter, volume buttons)
// Call this from the root component's onKeyPress handler
export function handleScanKeyEvent(event) {
  if (!isRunning) return false;

  const { key } = event.nativeEvent || event;

  if (scanMode === 'auto') {
    // In auto-scan: any key selects the current item
    if (key === ' ' || key === 'Enter' || key === 'Space') {
      selectCurrent();
      return true;
    }
  } else if (scanMode === 'step') {
    // In step-scan: space/volume advances, enter selects
    if (key === ' ' || key === 'Space' || key === 'ArrowDown') {
      advanceScan();
      return true;
    }
    if (key === 'Enter' || key === 'ArrowRight') {
      selectCurrent();
      return true;
    }
  }

  return false;
}

export function cleanup() {
  stopScan();
  scanItems = [];
  onChangeCallback = null;
  onSelectCallback = null;
}
