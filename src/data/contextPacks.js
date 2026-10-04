// src/data/contextPacks.js
// Context-aware vocabulary packs for different situations.
// Users can manually switch packs. Each pack provides a curated
// set of phrases relevant to that context.
//
// Design: These supplement (not replace) the core vocabulary.
// The AAC Board shows core words + the active context pack.

export const contextPacks = {
  home: {
    id: 'home',
    label: 'Home',
    icon: 'home-outline',
    color: '#2979FF',
    phrases: [
      { id: 'h1',  label: 'I want to watch TV', category: 'request' },
      { id: 'h2',  label: 'Can I have a snack?', category: 'request' },
      { id: 'h3',  label: 'I want to play', category: 'request' },
      { id: 'h4',  label: 'I need the toilet', category: 'urgent' },
      { id: 'h5',  label: "I'm bored", category: 'feeling' },
      { id: 'h6',  label: 'Can I go outside?', category: 'request' },
      { id: 'h7',  label: "I'm tired", category: 'feeling' },
      { id: 'h8',  label: 'Read me a story', category: 'request' },
      { id: 'h9',  label: 'I want quiet time', category: 'regulation' },
      { id: 'h10', label: 'Can you help me?', category: 'request' },
      { id: 'h11', label: "I'm hungry", category: 'feeling' },
      { id: 'h12', label: 'Goodnight', category: 'social' },
    ],
  },
  school: {
    id: 'school',
    label: 'School',
    icon: 'school-outline',
    color: '#4CAF50',
    audience: 'child',
    phrases: [
      { id: 's1',  label: "I don't understand", category: 'repair' },
      { id: 's2',  label: 'Can you repeat that?', category: 'repair' },
      { id: 's3',  label: 'I need help', category: 'urgent' },
      { id: 's4',  label: 'I need the toilet', category: 'urgent' },
      { id: 's5',  label: 'I finished', category: 'social' },
      { id: 's6',  label: "I'm confused", category: 'feeling' },
      { id: 's7',  label: 'Can I have a break?', category: 'regulation' },
      { id: 's8',  label: 'I want to try', category: 'social' },
      { id: 's9',  label: "That's not fair", category: 'social' },
      { id: 's10', label: 'I know the answer', category: 'social' },
      { id: 's11', label: 'Can I work with a friend?', category: 'request' },
      { id: 's12', label: "I'm doing my best", category: 'feeling' },
    ],
  },
  meals: {
    id: 'meals',
    label: 'Meals',
    icon: 'restaurant-outline',
    color: '#FF9800',
    phrases: [
      { id: 'm1',  label: 'More please', category: 'request' },
      { id: 'm2',  label: 'No thank you', category: 'social' },
      { id: 'm3',  label: "I don't like it", category: 'feeling' },
      { id: 'm4',  label: 'I want something else', category: 'request' },
      { id: 'm5',  label: 'Can I have water?', category: 'request' },
      { id: 'm6',  label: "I'm full", category: 'feeling' },
      { id: 'm7',  label: "It's too hot", category: 'comment' },
      { id: 'm8',  label: 'Yummy!', category: 'social' },
      { id: 'm9',  label: 'Can I have a drink?', category: 'request' },
      { id: 'm10', label: 'I want to try that', category: 'request' },
      { id: 'm11', label: "I'm still hungry", category: 'feeling' },
      { id: 'm12', label: 'Thank you for the food', category: 'social' },
    ],
  },
  outdoors: {
    id: 'outdoors',
    label: 'Outdoors',
    icon: 'sunny-outline',
    color: '#00BCD4',
    phrases: [
      { id: 'o1',  label: 'Look at that!', category: 'comment' },
      { id: 'o2',  label: 'I want to go there', category: 'request' },
      { id: 'o3',  label: 'Can we stay longer?', category: 'request' },
      { id: 'o4',  label: "I'm cold", category: 'feeling' },
      { id: 'o5',  label: "I'm hot", category: 'feeling' },
      { id: 'o6',  label: 'I need a rest', category: 'regulation' },
      { id: 'o7',  label: 'Can I play on that?', category: 'request' },
      { id: 'o8',  label: 'I want to go home', category: 'request' },
      { id: 'o9',  label: "That's fun!", category: 'social' },
      { id: 'o10', label: 'What is that?', category: 'comment' },
      { id: 'o11', label: 'I need the toilet', category: 'urgent' },
      { id: 'o12', label: "I'm scared", category: 'feeling' },
    ],
  },
  shopping: {
    id: 'shopping',
    label: 'Shopping',
    icon: 'cart-outline',
    color: '#9C27B0',
    phrases: [
      { id: 'sh1',  label: 'I want that one', category: 'request' },
      { id: 'sh2',  label: 'Can I look at it?', category: 'request' },
      { id: 'sh3',  label: 'Not that one', category: 'repair' },
      { id: 'sh4',  label: 'I like it', category: 'comment' },
      { id: 'sh5',  label: "I don't want it", category: 'comment' },
      { id: 'sh6',  label: 'Can we go now?', category: 'request' },
      { id: 'sh7',  label: "I'm tired", category: 'feeling' },
      { id: 'sh8',  label: 'How much is it?', category: 'comment' },
      { id: 'sh9',  label: 'The red one', category: 'comment' },
      { id: 'sh10', label: 'The big one', category: 'comment' },
      { id: 'sh11', label: 'Thank you', category: 'social' },
      { id: 'sh12', label: 'I need help choosing', category: 'request' },
    ],
  },
  clinic: {
    id: 'clinic',
    label: 'Clinic',
    icon: 'medkit-outline',
    color: '#F44336',
    phrases: [
      { id: 'c1',  label: 'It hurts here', category: 'urgent' },
      { id: 'c2',  label: "I'm scared", category: 'feeling' },
      { id: 'c3',  label: 'I need a break', category: 'regulation' },
      { id: 'c4',  label: "I don't understand", category: 'repair' },
      { id: 'c5',  label: 'Can you explain?', category: 'request' },
      { id: 'c6',  label: "I'm feeling better", category: 'feeling' },
      { id: 'c7',  label: "I'm feeling worse", category: 'feeling' },
      { id: 'c8',  label: 'When will it be over?', category: 'request' },
      { id: 'c9',  label: 'I need the toilet', category: 'urgent' },
      { id: 'c10', label: 'I want my parent', category: 'request' },
      { id: 'c11', label: "I'm OK", category: 'social' },
      { id: 'c12', label: 'Thank you', category: 'social' },
    ],
  },
  regulation: {
    id: 'regulation',
    label: 'Feelings',
    icon: 'heart-outline',
    color: '#E91E63',
    phrases: [
      { id: 'r1',  label: "I'm upset", category: 'feeling' },
      { id: 'r2',  label: 'I need space', category: 'regulation' },
      { id: 'r3',  label: "I'm angry", category: 'feeling' },
      { id: 'r4',  label: 'I need a hug', category: 'request' },
      { id: 'r5',  label: "I'm worried", category: 'feeling' },
      { id: 'r6',  label: 'I need quiet', category: 'regulation' },
      { id: 'r7',  label: "I'm happy", category: 'feeling' },
      { id: 'r8',  label: 'I feel safe', category: 'feeling' },
      { id: 'r9',  label: "I don't know how I feel", category: 'feeling' },
      { id: 'r10', label: 'Can we talk?', category: 'request' },
      { id: 'r11', label: 'I need to breathe', category: 'regulation' },
      { id: 'r12', label: "I'm OK now", category: 'social' },
    ],
  },
  university: {
    id: 'university',
    label: 'University',
    icon: 'library-outline',
    color: '#3949AB',
    audience: 'adult',
    phrases: [
      { id: 'u1',  label: 'Can I have the slides after the lecture?', category: 'request' },
      { id: 'u2',  label: 'I use this app to communicate', category: 'social' },
      { id: 'u3',  label: 'Please give me a moment to type my answer', category: 'repair' },
      { id: 'u4',  label: 'I have a question', category: 'social' },
      { id: 'u5',  label: 'Can you email me that?', category: 'request' },
      { id: 'u6',  label: 'I need extra time for this', category: 'request' },
      { id: 'u7',  label: 'Can we work on this together?', category: 'request' },
      { id: 'u8',  label: 'I agree', category: 'social' },
      { id: 'u9',  label: 'I see it differently', category: 'social' },
      { id: 'u10', label: 'Where is the room?', category: 'request' },
    ],
  },
  work: {
    id: 'work',
    label: 'Work',
    icon: 'briefcase-outline',
    color: '#00695C',
    audience: 'adult',
    phrases: [
      { id: 'w1',  label: 'Good morning', category: 'social' },
      { id: 'w2',  label: 'I will finish this today', category: 'social' },
      { id: 'w3',  label: 'Can you send me the details?', category: 'request' },
      { id: 'w4',  label: 'I need a few minutes to reply', category: 'repair' },
      { id: 'w5',  label: 'Can we talk about this later?', category: 'request' },
      { id: 'w6',  label: 'I have finished', category: 'social' },
      { id: 'w7',  label: "I don't agree", category: 'social' },
      { id: 'w8',  label: 'Can you put that in writing?', category: 'request' },
      { id: 'w9',  label: 'I am taking a break', category: 'regulation' },
      { id: 'w10', label: 'Thanks for waiting', category: 'social' },
    ],
  },
  appointments: {
    id: 'appointments',
    label: 'Appointments',
    icon: 'calendar-outline',
    color: '#AD1457',
    audience: 'adult',
    phrases: [
      { id: 'a1',  label: 'I have an appointment', category: 'social' },
      { id: 'a2',  label: 'Please speak to me, not my companion', category: 'repair' },
      { id: 'a3',  label: 'Please give me time to answer', category: 'repair' },
      { id: 'a4',  label: 'It hurts here', category: 'urgent' },
      { id: 'a5',  label: 'It started a few days ago', category: 'social' },
      { id: 'a6',  label: 'Can you explain that again?', category: 'repair' },
      { id: 'a7',  label: 'Can you write it down?', category: 'request' },
      { id: 'a8',  label: 'I am worried about this', category: 'feeling' },
      { id: 'a9',  label: 'I do not consent to that', category: 'urgent' },
      { id: 'a10', label: 'What happens next?', category: 'request' },
    ],
  },
  social: {
    id: 'social',
    label: 'Social',
    icon: 'people-outline',
    color: '#6A1B9A',
    phrases: [
      { id: 'so1',  label: 'Hi, how are you?', category: 'social' },
      { id: 'so2',  label: 'I use this to talk', category: 'social' },
      { id: 'so3',  label: 'That is funny', category: 'social' },
      { id: 'so4',  label: 'Tell me more', category: 'social' },
      { id: 'so5',  label: 'What have you been doing?', category: 'social' },
      { id: 'so6',  label: 'I would like to join in', category: 'request' },
      { id: 'so7',  label: 'Can you wait for me to finish?', category: 'repair' },
      { id: 'so8',  label: 'See you soon', category: 'social' },
      { id: 'so9',  label: 'I had a great time', category: 'feeling' },
      { id: 'so10', label: 'I need some quiet', category: 'regulation' },
    ],
  },
  emergency: {
    id: 'emergency',
    label: 'Emergency',
    icon: 'warning-outline',
    color: '#D32F2F',
    phrases: [
      { id: 'e1',  label: 'I need help NOW', category: 'urgent' },
      { id: 'e2',  label: 'I am in pain', category: 'urgent' },
      { id: 'e3',  label: 'Call for help', category: 'urgent' },
      { id: 'e4',  label: 'I need the toilet', category: 'urgent' },
      { id: 'e5',  label: "I can't breathe", category: 'urgent' },
      { id: 'e6',  label: "I'm going to be sick", category: 'urgent' },
      { id: 'e7',  label: 'Stop', category: 'urgent' },
      { id: 'e8',  label: "I'm lost", category: 'urgent' },
      { id: 'e9',  label: "I don't feel safe", category: 'urgent' },
      { id: 'e10', label: 'Take me home', category: 'urgent' },
      { id: 'e11', label: 'I need my medicine', category: 'urgent' },
      { id: 'e12', label: 'Something is wrong', category: 'urgent' },
    ],
  },
};

export function getContextPack(id) {
  return contextPacks[id] || null;
}

export function getContextPackIds() {
  return Object.keys(contextPacks);
}

/**
 * Packs in display order for a mode. Every pack is available in both modes;
 * packs written for the other audience are listed after the rest.
 */
export function getContextPacksForMode(mode) {
  const all = Object.values(contextPacks);
  const other = mode === 'child' ? 'adult' : 'child';
  return [...all.filter(p => p.audience !== other), ...all.filter(p => p.audience === other)];
}

export function getAllContextPacks() {
  return Object.values(contextPacks);
}
