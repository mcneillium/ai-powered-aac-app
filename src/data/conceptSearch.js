// A small, explicit offline index. Related words are offered as choices; never
// infer what a person means, rewrite their message, or move their board tiles.
import { searchVocabulary } from './coreVocabulary';

export const FINDER_CONCEPTS = [
  { label: 'Food & drink', emoji: '🥤', query: 'thirsty' },
  { label: 'People', emoji: '👪', query: 'family' },
  { label: 'Places', emoji: '🏠', query: 'place' },
  { label: 'Feelings', emoji: '🙂', query: 'feeling' },
  { label: 'Help', emoji: '🆘', query: 'help' },
  { label: 'Things', emoji: '🧸', query: 'thing' },
];

const GROUPS = [
  { cues: ['thirsty', 'drink', 'beverage', 'drinks'], words: ['drink', 'water', 'juice', 'milk', 'thirsty'] },
  { cues: ['hungry', 'food', 'eat', 'snack', 'meal'], words: ['eat', 'hungry', 'food', 'apple', 'bread', 'banana'] },
  { cues: ['toilet', 'bathroom', 'loo', 'restroom', 'washroom'], words: ['bathroom', 'toilet'] },
  { cues: ['mum', 'mother', 'mom'], words: ['mom'] },
  { cues: ['father', 'daddy', 'dad'], words: ['dad'] },
  { cues: ['family', 'people', 'person'], words: ['mom', 'dad', 'brother', 'sister', 'friend', 'teacher', 'doctor', 'baby'] },
  { cues: ['place', 'places', 'somewhere'], words: ['home', 'school', 'park', 'shop', 'hospital', 'bathroom', 'outside'] },
  { cues: ['feeling', 'feelings', 'emotion'], words: ['happy', 'sad', 'angry', 'tired', 'scared', 'hurt', 'excited'] },
  { cues: ['hurt', 'pain', 'sore', 'unwell'], words: ['hurt', 'pain', 'doctor', 'help'] },
  { cues: ['overwhelmed', 'noise', 'noisy', 'quiet', 'break'], words: ['stop', 'quiet', 'wait', 'tired', 'help'] },
  { cues: ['help', 'confused', 'understand'], words: ['help', 'wait', 'say that again', "I don't know"] },
  { cues: ['thing', 'things', 'object'], words: ['book', 'ball', 'phone', 'toy', 'cup', 'chair', 'bag'] },
];

export function findRelatedVocabulary(query, limit = 30) {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (!q) return [];
  const direct = searchVocabulary(q, limit).map(result => ({ ...result, related: false }));
  const seen = new Set(direct.map(r => `${r.pageId}:${r.button.id}`));
  const tokens = new Set(q.match(/[a-z]+/g) || []);
  const related = [];
  for (const group of GROUPS) {
    if (!group.cues.some(cue => tokens.has(cue))) continue;
    for (const word of group.words) {
      for (const result of searchVocabulary(word, 100)) {
        const key = `${result.pageId}:${result.button.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        related.push({ ...result, related: true });
      }
    }
  }
  return [...direct, ...related].slice(0, Math.max(0, limit));
}
