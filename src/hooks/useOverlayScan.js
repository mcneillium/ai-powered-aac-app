// src/hooks/useOverlayScan.js
// Lets a sheet take over in-app switch scanning while it is open, then hand
// it back to the board exactly as it was (items, callbacks, running state) —
// the same approach QuickRepairOverlay uses. Scanning inside the sheet only
// starts if the board was already scanning, so it never surprises anyone.
//
//   const focusedId = useOverlayScan(visible, [{ id, label, onSelect }, ...]);

import { useEffect, useRef, useState } from 'react';
import {
  saveScanContext, restoreScanContext, setScanItems, onScanChange, onScanSelect,
  startScan, stopScan, getScanState,
} from '../services/switchScanService';

export function useOverlayScan(active, items) {
  const [focusedId, setFocusedId] = useState(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const taken = useRef(false);
  const idKey = items.map((i) => i.id).join('|');

  // Take over when the sheet opens (only if the board was scanning).
  useEffect(() => {
    if (!active) return undefined;
    const saved = saveScanContext();
    if (!saved.wasRunning) return undefined;
    taken.current = true;
    stopScan();
    setScanItems(itemsRef.current);
    onScanChange(({ currentIndex, isRunning }) => {
      setFocusedId(isRunning && currentIndex >= 0 ? itemsRef.current[currentIndex]?.id || null : null);
    });
    onScanSelect(({ item }) => {
      const current = itemsRef.current.find((i) => i.id === item?.id);
      current?.onSelect?.();
    });
    startScan();
    return () => {
      taken.current = false;
      setFocusedId(null);
      restoreScanContext(saved);
    };
  }, [active]);

  // Keep the scan list in step with the sheet's content (e.g. a new
  // situation chosen in Phrases) without restarting from scratch needlessly.
  useEffect(() => {
    if (!active || !taken.current) return;
    setScanItems(itemsRef.current);
    if (!getScanState().isRunning) startScan();
  }, [active, idKey]);

  return focusedId;
}
