import { TOPICS, composeExplanation, getTopic } from '../services/explainComposer';

describe('Help me explain', () => {
  test('pain: child and adult wording', () => {
    const c = { where: 'tummy', how: 'severe', since: 'today', want: 'medicine' };
    expect(composeExplanation('pain', c, 'child'))
      .toBe('My tummy hurts. It hurts really badly. It started today. I need medicine.');
    expect(composeExplanation('pain', c, 'adult'))
      .toBe('I have pain in my stomach. It is severe. It started today. I would like pain relief.');
  });

  test('skipped steps are left out cleanly', () => {
    expect(composeExplanation('pain', { where: 'head' }, 'adult')).toBe('I have pain in my head.');
    expect(composeExplanation('need', { what: 'toilet', when: 'now' }, 'child')).toBe('I need the toilet now.');
    expect(composeExplanation('feeling', { feel: 'worried', because: 'dontknow' }, 'adult'))
      .toBe("I feel anxious. I'm not sure why.");
  });

  test('something happened and not understanding', () => {
    expect(composeExplanation('happened', { what: 'lost', where: 'school', when: 'today', feel: 'upset' }, 'child'))
      .toBe("I lost something at school today. I'm upset. Can we talk about it?");
    expect(composeExplanation('happened', { what: 'good' }, 'adult')).toBe('Something good happened.');
    expect(composeExplanation('understand', { ask: 'slower' }, 'adult'))
      .toBe("Sorry, I didn't understand. Could you speak more slowly, please?");
  });

  test('unknown topic or option ids produce nothing rather than a broken sentence', () => {
    expect(composeExplanation('nope', {}, 'adult')).toBe('');
    expect(composeExplanation('pain', { where: 'elbowz' }, 'adult')).toBe('');
  });

  test('every option of every topic composes a non-empty, tidy sentence in both modes', () => {
    TOPICS.forEach((topic) => {
      const first = topic.steps[0];
      first.options.forEach((o) => {
        ['child', 'adult'].forEach((x) => {
          const text = composeExplanation(topic.id, { [first.id]: o.id }, x);
          expect(text.length).toBeGreaterThan(3);
          expect(text).not.toMatch(/undefined|null|\s{2}|\s\./);
          expect(text).toMatch(/[.?!]$/);
        });
      });
    });
  });

  test('every option has a label for both modes and ids are unique per step', () => {
    TOPICS.forEach((topic) => {
      expect(getTopic(topic.id)).toBe(topic);
      topic.steps.forEach((step) => {
        const ids = step.options.map(o => o.id);
        expect(new Set(ids).size).toBe(ids.length);
        step.options.forEach(o => { expect(o.child).toBeTruthy(); expect(o.adult).toBeTruthy(); });
      });
    });
  });
});
