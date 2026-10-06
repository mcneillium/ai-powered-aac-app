// Voice-specific portable vocabulary format; deliberately not OBF or account backup.
export const PORTABLE_FORMAT = 'voice-portable-vocabulary';
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ITEMS = 250;
export const MAX_PHOTO_BASE64 = 2 * 1024 * 1024;
const CATEGORIES = new Set(['pronoun', 'verb', 'adjective', 'noun', 'social', 'important', 'misc']);
const normal = (word) => String(word).trim().toLocaleLowerCase();

export function safePhoto(photo) {
  if (photo == null) return null;
  if (!photo || typeof photo !== 'object' || !['image/jpeg', 'image/png'].includes(photo.mime)
      || typeof photo.base64 !== 'string' || photo.base64.length > MAX_PHOTO_BASE64
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(photo.base64)
      || photo.base64.length % 4 !== 0
      || !(photo.mime === 'image/png' ? photo.base64.startsWith('iVBORw0KGgo') : photo.base64.startsWith('/9j/'))) {
    throw new Error('A picture is unsupported or exceeds the 2 MB encoded limit.');
  }
  return { mime: photo.mime, base64: photo.base64 };
}

export function parsePortableBoard(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_FILE_BYTES) throw new Error('Choose a Voice vocabulary file smaller than 20 MB.');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('This is not a readable JSON vocabulary file.'); }
  if (!value || value.format !== PORTABLE_FORMAT || value.version !== 1 || !Array.isArray(value.personalWords)) throw new Error('Choose a supported Voice vocabulary version 1 file.');
  if (value.personalWords.length > MAX_ITEMS) throw new Error('A file can contain up to 250 personal words.');
  // Core-page snapshots are reference-only and never trusted for import.
  return {
    format: PORTABLE_FORMAT, version: 1,
    personalWords: value.personalWords.map((item) => {
      if (!item || typeof item.word !== 'string' || !item.word.trim() || item.word.length > 120 || /[\u0000-\u001f]/.test(item.word) || !CATEGORIES.has(item.category)) throw new Error('A personal word has an invalid label or category.');
      return { word: item.word.trim(), category: item.category, photo: safePhoto(item.photo) };
    }),
  };
}

export function previewPortableImport(board, existingWords = [], coreLabels = []) {
  const existing = new Set([...existingWords.map((item) => normal(item.word)), ...coreLabels.map(normal)]);
  const add = [];
  const skipped = [];
  for (const item of board.personalWords) {
    if (existing.has(normal(item.word))) skipped.push({ word: item.word, reason: 'Label already exists: kept existing word and picture' });
    else { add.push(item); existing.add(normal(item.word)); }
  }
  return { add, skipped };
}

export function escapeBoardHTML(text) {
  return String(text ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

/** Original labels stay visible. Only validated embedded images enter HTML. */
export function printableBoardHTML(board) {
  const esc = escapeBoardHTML;
  const tile = (item) => {
    const photo = safePhoto(item.photo);
    const visual = photo ? `<img alt="" src="data:${photo.mime};base64,${photo.base64}">` : `<span class="symbol">${esc(item.emoji || '')}</span>`;
    return `<div class="tile">${visual}<div>${esc(item.label || item.word)}</div>${item.navigateTo ? '<small>Page</small>' : ''}</div>`;
  };
  const pages = [...(board.corePages || []), { label: 'My words', buttons: board.personalWords || [] }];
  const columns = Math.max(2, Math.min(6, Number.isInteger(board.columns) ? board.columns : 3));
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111}h1{font-size:22px}.page{break-before:page}.page:first-child{break-before:auto}.grid{display:grid;grid-template-columns:repeat(${columns},1fr);gap:8px}.tile{border:2px solid #444;border-radius:8px;min-height:100px;padding:8px;text-align:center;break-inside:avoid;overflow-wrap:anywhere;font-size:18px}.symbol{display:block;font-size:30px;min-height:35px}img{width:64px;height:64px;object-fit:contain}small{display:block;font-size:12px}.note{font-size:12px}</style></head><body>${pages.filter((page) => page.buttons.length).map((page) => `<section class="page"><h1>${esc(page.label)}</h1><p class="note">Voice printable communication board. Point to a word or picture. This paper copy cannot speak or open pages.</p><div class="grid">${page.buttons.map(tile).join('')}</div></section>`).join('')}</body></html>`;
}
