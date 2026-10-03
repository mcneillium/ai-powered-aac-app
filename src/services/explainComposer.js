// src/services/explainComposer.js
// "Help me explain": turns a few taps into a complete, clear message for
// situations that are hard to put together word by word (pain, a need,
// a feeling, something that happened, not understanding).
//
// Entirely offline and template-based: no text leaves the device and nothing
// is generated that the user did not choose. Every step can be skipped
// except the first, and the result is placed in the message bar for the
// user to check, change or speak — it is never spoken automatically.
//
// Each option has wording for both experiences: Child is short and concrete,
// Adult is fuller and more precise.

const opt = (id, child, adult = child, emoji = null) => ({ id, child, adult, emoji });

export const TOPICS = [
  {
    id: 'pain',
    emoji: '🤕',
    title: { child: 'Something hurts', adult: 'Pain or feeling unwell' },
    steps: [
      {
        id: 'where',
        question: { child: 'Where does it hurt?', adult: 'Where is it?' },
        options: [
          opt('head', 'head', 'head', '🧠'), opt('tummy', 'tummy', 'stomach', '🫃'),
          opt('tooth', 'tooth', 'tooth', '🦷'), opt('ear', 'ear', 'ear', '👂'),
          opt('throat', 'throat', 'throat', '🗣️'), opt('back', 'back', 'back', '🔙'),
          opt('chest', 'chest', 'chest', '🫁'), opt('arm', 'arm', 'arm', '💪'),
          opt('leg', 'leg', 'leg', '🦵'), opt('everywhere', 'all over', 'all over', '🌀'),
        ],
      },
      {
        id: 'how',
        question: { child: 'How much?', adult: 'How bad is it?' },
        options: [
          opt('little', 'a little', 'mild', '🙂'),
          opt('medium', 'a lot', 'moderate', '😣'),
          opt('severe', 'really badly', 'severe', '😫'),
        ],
      },
      {
        id: 'since',
        question: { child: 'When did it start?', adult: 'When did it start?' },
        options: [
          opt('now', 'just now', 'just now', '⏱️'), opt('today', 'today', 'today', '☀️'),
          opt('yesterday', 'yesterday', 'yesterday', '🌙'), opt('days', 'a few days ago', 'a few days ago', '📅'),
        ],
      },
      {
        id: 'want',
        question: { child: 'What do you need?', adult: 'What would help?' },
        options: [
          opt('medicine', 'medicine', 'pain relief', '💊'), opt('doctor', 'a doctor', 'a doctor', '🧑‍⚕️'),
          opt('lie', 'to lie down', 'to lie down', '🛏️'), opt('quiet', 'quiet', 'somewhere quiet', '🤫'),
        ],
      },
    ],
    compose(c, x) {
      const parts = [];
      if (x === 'child') {
        if (c.where) parts.push(c.where.id === 'everywhere' ? 'I hurt all over.' : `My ${c.where.child} hurts.`);
        if (c.how) parts.push(`It hurts ${c.how.child}.`);
        if (c.since) parts.push(`It started ${c.since.child}.`);
        if (c.want) parts.push(`I need ${c.want.child}.`);
      } else {
        if (c.where) parts.push(c.where.id === 'everywhere' ? 'I have pain all over.' : `I have pain in my ${c.where.adult}.`);
        if (c.how) parts.push(`It is ${c.how.adult}.`);
        if (c.since) parts.push(`It started ${c.since.adult}.`);
        if (c.want) parts.push(`I would like ${c.want.adult}.`);
      }
      return parts.join(' ');
    },
  },
  {
    id: 'need',
    emoji: '🫴',
    title: { child: 'I need something', adult: 'I need something' },
    steps: [
      {
        id: 'what',
        question: { child: 'What do you need?', adult: 'What do you need?' },
        options: [
          opt('drink', 'a drink', 'a drink', '🥤'), opt('food', 'something to eat', 'something to eat', '🍎'),
          opt('toilet', 'the toilet', 'the toilet', '🚽'), opt('break', 'a break', 'a break', '⏸️'),
          opt('quiet', 'some quiet', 'somewhere quiet', '🤫'), opt('help', 'help', 'some help', '🆘'),
          opt('medicine', 'my medicine', 'my medication', '💊'), opt('home', 'to go home', 'to go home', '🏠'),
        ],
      },
      {
        id: 'when',
        question: { child: 'When?', adult: 'How soon?' },
        options: [
          opt('now', 'now', 'now, please', '❗'), opt('soon', 'soon', 'soon', '⏳'), opt('later', 'later', 'later, not now', '🕒'),
        ],
      },
      {
        id: 'why',
        question: { child: 'Why?', adult: 'Do you want to say why?' },
        options: [
          opt('tired', "I'm tired", "I'm tired", '😴'), opt('noisy', "it's too noisy", "it's too noisy", '🔊'),
          opt('unwell', "I don't feel well", "I don't feel well", '🤒'), opt('busy', "it's too busy", "there are too many people", '👥'),
        ],
      },
    ],
    compose(c, x) {
      const parts = [];
      if (c.what) {
        const w = c.what[x];
        const when = c.when ? ` ${c.when[x]}` : '';
        parts.push(`I need ${w}${when}.`);
      }
      if (c.why) parts.push(x === 'child' ? `Because ${c.why.child}.` : `It's because ${c.why.adult}.`);
      return parts.join(' ');
    },
  },
  {
    id: 'feeling',
    emoji: '💭',
    title: { child: 'How I feel', adult: 'How I feel' },
    steps: [
      {
        id: 'feel',
        question: { child: 'How do you feel?', adult: 'How do you feel?' },
        options: [
          opt('happy', 'happy', 'happy', '😊'), opt('sad', 'sad', 'sad', '😢'), opt('worried', 'worried', 'anxious', '😟'),
          opt('angry', 'angry', 'frustrated', '😠'), opt('tired', 'tired', 'exhausted', '😴'),
          opt('overwhelmed', 'too much', 'overwhelmed', '🌪️'), opt('bored', 'bored', 'bored', '🥱'),
          opt('excited', 'excited', 'excited', '🤩'),
        ],
      },
      {
        id: 'because',
        question: { child: 'Why?', adult: 'What is it about?' },
        options: [
          opt('noise', 'the noise', 'the noise', '🔊'), opt('people', 'people', 'other people', '👥'),
          opt('happened', 'something that happened', 'something that happened', '❗'),
          opt('change', 'a change', 'a change in plans', '🔀'), opt('dontknow', "I don't know", "I'm not sure", '🤷'),
        ],
      },
      {
        id: 'want',
        question: { child: 'What would help?', adult: 'What would help?' },
        options: [
          opt('hug', 'a hug', 'some comfort', '🤗'), opt('space', 'some space', 'some space', '🚪'),
          opt('talk', 'to talk', 'to talk about it', '💬'), opt('quiet', 'quiet time', 'quiet time', '🤫'),
          opt('nothing', 'nothing', 'nothing right now', '👌'),
        ],
      },
    ],
    compose(c, x) {
      const parts = [];
      if (c.feel) {
        const f = c.feel[x];
        parts.push(c.feel.id === 'overwhelmed' && x === 'child' ? 'It is all too much.' : `I feel ${f}.`);
      }
      if (c.because) {
        parts.push(c.because.id === 'dontknow'
          ? `${c.because[x]} why.`
          : `It's because of ${c.because[x]}.`);
      }
      if (c.want) {
        parts.push(c.want.id === 'nothing'
          ? (x === 'child' ? 'I am OK for now.' : "I don't need anything right now.")
          : `I would like ${c.want[x]}.`);
      }
      return parts.join(' ');
    },
  },
  {
    id: 'happened',
    emoji: '❗',
    title: { child: 'Something happened', adult: 'Something happened' },
    steps: [
      {
        id: 'what',
        question: { child: 'What happened?', adult: 'What happened?' },
        options: [
          opt('hurt', 'someone hurt me', 'someone hurt me', '🤕'), opt('lost', 'I lost something', 'I lost something', '🔍'),
          opt('broke', 'something broke', 'something got broken', '💔'), opt('mean', 'someone was mean', 'someone was unkind to me', '😠'),
          opt('wrong', 'something went wrong', 'something went wrong', '⚠️'), opt('good', 'something good', 'something good happened', '🎉'),
        ],
      },
      {
        id: 'where',
        question: { child: 'Where?', adult: 'Where?' },
        options: [
          opt('school', 'at school', 'at school', '🏫'), opt('home', 'at home', 'at home', '🏠'),
          opt('outside', 'outside', 'outside', '🌳'), opt('work', 'at work', 'at work', '💼'),
          opt('car', 'in the car', 'while travelling', '🚗'),
        ],
      },
      {
        id: 'when',
        question: { child: 'When?', adult: 'When?' },
        options: [
          opt('now', 'just now', 'just now', '⏱️'), opt('today', 'today', 'earlier today', '☀️'),
          opt('yesterday', 'yesterday', 'yesterday', '🌙'),
        ],
      },
      {
        id: 'feel',
        question: { child: 'How do you feel?', adult: 'How are you now?' },
        options: [
          opt('upset', "I'm upset", "I'm upset", '😢'), opt('scared', "I'm scared", "I'm frightened", '😨'),
          opt('ok', "I'm OK", "I'm OK", '🙂'), opt('happy', "I'm happy", "I'm pleased", '😊'),
        ],
      },
    ],
    compose(c, x) {
      const parts = [];
      if (c.what) {
        const what = c.what[x];
        const lead = c.what.id === 'good'
          ? 'Something good happened'
          : `${what.charAt(0).toUpperCase()}${what.slice(1)}`;
        const where = c.where ? ` ${c.where[x]}` : '';
        const when = c.when ? ` ${c.when[x]}` : '';
        parts.push(`${lead}${where}${when}.`);
      }
      if (c.feel) parts.push(`${c.feel[x]}.`);
      if (c.what && c.what.id !== 'good') parts.push('Can we talk about it?');
      return parts.join(' ');
    },
  },
  {
    id: 'understand',
    emoji: '❓',
    title: { child: "I don't understand", adult: "I didn't understand" },
    steps: [
      {
        id: 'ask',
        question: { child: 'What would help?', adult: 'What would help?' },
        options: [
          opt('again', 'say it again', 'say that again', '🔁'), opt('slower', 'go slower', 'speak more slowly', '🐢'),
          opt('show', 'show me', 'show me', '👀'), opt('simple', 'use easy words', 'use simpler words', '🔤'),
          opt('write', 'write it down', 'write it down', '✏️'), opt('time', 'give me time', 'give me a moment to answer', '⏳'),
        ],
      },
    ],
    compose(c, x) {
      if (!c.ask) return '';
      return x === 'child'
        ? `I don't understand. Please ${c.ask.child}.`
        : `Sorry, I didn't understand. Could you ${c.ask.adult}, please?`;
    },
  },
];

export function getTopic(id) {
  return TOPICS.find(t => t.id === id) || null;
}

/**
 * Build the message for a topic from the chosen options.
 * @param {string} topicId
 * @param {Record<string,string>} choices  stepId -> optionId
 * @param {'child'|'adult'} experience
 */
export function composeExplanation(topicId, choices, experience = 'adult') {
  const topic = getTopic(topicId);
  if (!topic) return '';
  const x = experience === 'child' ? 'child' : 'adult';
  const resolved = {};
  topic.steps.forEach(step => {
    const id = choices && choices[step.id];
    const o = id && step.options.find(op => op.id === id);
    if (o) resolved[step.id] = o;
  });
  return topic.compose(resolved, x).replace(/\s+/g, ' ').trim();
}
