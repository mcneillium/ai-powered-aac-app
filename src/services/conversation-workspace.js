import AsyncStorage from '@react-native-async-storage/async-storage';

export const CONVERSATION_KEY = '@voice_conversation_drafts_v1';
export const MAX_DRAFTS = 10;
export const MAX_MESSAGE_LENGTH = 4000;
let sequence = Promise.resolve();
let generation = 0;
let serial = 0;
let pendingReturn = null;
const clearListeners = new Set();

const serialise = task => {
  const result = sequence.then(task);
  sequence = result.catch(() => {});
  return result;
};

function validMessage(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Write a message first.');
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Messages can contain up to ${MAX_MESSAGE_LENGTH} characters.`);
  return text;
}

async function read() {
  const raw = await AsyncStorage.getItem(CONVERSATION_KEY);
  if (!raw) return [];
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Saved drafts could not be read. They have been left untouched.'); }
  if (data?.version !== 1 || !Array.isArray(data.drafts) || data.drafts.length > MAX_DRAFTS
      || data.drafts.some(d => !d || typeof d.id !== 'string' || typeof d.text !== 'string'
        || !d.text.trim() || d.text.length > MAX_MESSAGE_LENGTH || !Number.isFinite(d.createdAt))) {
    throw new Error('Saved drafts have an unsupported format. They have been left untouched.');
  }
  return data.drafts;
}

export function listConversationDrafts() { return serialise(read); }

export function conversationGeneration() { return generation; }

export function parkConversationDraft(text, expectedGeneration = generation) {
  const epoch = expectedGeneration;
  return serialise(async () => {
    if (epoch !== generation) throw new Error('Draft saving was cancelled because personal data was deleted.');
    validMessage(text);
    const drafts = await read();
    if (epoch !== generation) throw new Error('Draft saving was cancelled because personal data was deleted.');
    const duplicate = drafts.find(d => d.text === text);
    if (duplicate) return duplicate;
    if (drafts.length >= MAX_DRAFTS) throw new Error('All 10 draft spaces are full. Delete a saved draft first; your current message is still here.');
    const draft = { id: `${Date.now()}-${++serial}`, text, createdAt: Date.now() };
    await AsyncStorage.setItem(CONVERSATION_KEY, JSON.stringify({ version: 1, drafts: [draft, ...drafts] }));
    if (epoch !== generation) throw new Error('Draft saving was cancelled because personal data was deleted.');
    return draft;
  });
}

export function deleteConversationDraft(id) {
  const epoch = generation;
  return serialise(async () => {
    const drafts = await read();
    if (epoch !== generation) return;
    await AsyncStorage.setItem(CONVERSATION_KEY, JSON.stringify({ version: 1, drafts: drafts.filter(d => d.id !== id) }));
  });
}

/** Deletion drains any in-flight writes before removing the key. */
export function clearConversationWorkspace() {
  generation++;
  pendingReturn = null;
  clearListeners.forEach(fn => { try { fn(); } catch { /* deletion must continue */ } });
  return serialise(() => AsyncStorage.removeItem(CONVERSATION_KEY));
}

export function subscribeConversationClear(fn) {
  clearListeners.add(fn);
  return () => clearListeners.delete(fn);
}

export function queueWorkspaceReturn(text) { pendingReturn = validMessage(text); }
export function consumeWorkspaceReturn() {
  const text = pendingReturn;
  pendingReturn = null;
  return text;
}

// Original, deliberately small English helper. These are alternatives, never
// automatic corrections or a claim to understand intended tense/meaning.
const FORMS = [
  ['go', 'goes', 'going', 'went', 'gone'], ['want', 'wants', 'wanting', 'wanted'],
  ['need', 'needs', 'needing', 'needed'], ['eat', 'eats', 'eating', 'ate', 'eaten'],
  ['drink', 'drinks', 'drinking', 'drank', 'drunk'], ['see', 'sees', 'seeing', 'saw', 'seen'],
  ['play', 'plays', 'playing', 'played'], ['feel', 'feels', 'feeling', 'felt'],
  ['like', 'likes', 'liking', 'liked'], ['help', 'helps', 'helping', 'helped'],
  ['is', 'am', 'are', 'was', 'were', 'be', 'been', 'being'],
];
export function wordFormChoices(text) {
  const match = typeof text === 'string' && text.match(/([A-Za-z]+)([.!?,;:]*)\s*$/);
  if (!match) return [];
  const choices = FORMS.find(forms => forms.includes(match[1].toLowerCase()));
  if (!choices) return [];
  return choices.filter(word => word !== match[1].toLowerCase()).map(word => {
    const display = /^[A-Z]/.test(match[1]) ? word[0].toUpperCase() + word.slice(1) : word;
    return { word: display, text: text.slice(0, match.index) + display + match[2] };
  });
}
