import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONVERSATION_KEY, parkConversationDraft, listConversationDrafts, deleteConversationDraft,
  clearConversationWorkspace, queueWorkspaceReturn, consumeWorkspaceReturn, wordFormChoices, conversationGeneration } from '../services/conversation-workspace';

beforeEach(async () => { await clearConversationWorkspace(); await AsyncStorage.clear(); });

test('serial saves preserve multiple drafts and an identical message does not consume another slot', async () => {
  const [a, b] = await Promise.all([parkConversationDraft('hello'), parkConversationDraft('please wait')]);
  expect(a.id).not.toBe(b.id);
  expect((await parkConversationDraft('hello')).id).toBe(a.id);
  expect((await listConversationDrafts()).map(d => d.text)).toEqual(['please wait', 'hello']);
  await deleteConversationDraft(a.id);
  expect((await listConversationDrafts()).map(d => d.text)).toEqual(['please wait']);
});

test('full draft list refuses new messages without silently discarding old ones', async () => {
  for (let i = 0; i < 10; i++) await parkConversationDraft(`message ${i}`);
  await expect(parkConversationDraft('message eleven')).rejects.toThrow('full');
  expect(await listConversationDrafts()).toHaveLength(10);
});

test('invalid stored data is never overwritten by saving', async () => {
  await AsyncStorage.setItem(CONVERSATION_KEY, 'broken');
  await expect(parkConversationDraft('new')).rejects.toThrow('untouched');
  expect(await AsyncStorage.getItem(CONVERSATION_KEY)).toBe('broken');
});

test('deletion cancels queued drafts and pending board handoff', async () => {
  queueWorkspaceReturn('private draft');
  const saving = parkConversationDraft('queued draft');
  const rejected = expect(saving).rejects.toThrow('cancelled');
  await clearConversationWorkspace();
  await rejected;
  expect(await AsyncStorage.getItem(CONVERSATION_KEY)).toBeNull();
  expect(consumeWorkspaceReturn()).toBeNull();
});

test('explicit board handoff is consumed only once and validates text', () => {
  expect(() => queueWorkspaceReturn('')).toThrow('message');
  queueWorkspaceReturn('I would like to speak');
  expect(consumeWorkspaceReturn()).toBe('I would like to speak');
  expect(consumeWorkspaceReturn()).toBeNull();
});

test('a stale save-dialog callback cannot recreate deleted personal data', async () => {
  const dialogGeneration = conversationGeneration();
  await clearConversationWorkspace();
  await expect(parkConversationDraft('old dialog message', dialogGeneration)).rejects.toThrow('cancelled');
  expect(await AsyncStorage.getItem(CONVERSATION_KEY)).toBeNull();
});

test('deletion drains an in-flight write before removing its data', async () => {
  const original = AsyncStorage.setItem.getMockImplementation();
  let release;
  let started;
  const entered = new Promise(resolve => { started = resolve; });
  AsyncStorage.setItem.mockImplementationOnce(async (...args) => {
    started();
    await new Promise(resolve => { release = resolve; });
    return original(...args);
  });
  const saving = parkConversationDraft('in flight');
  const rejected = expect(saving).rejects.toThrow('cancelled');
  await entered;
  const deleting = clearConversationWorkspace();
  release();
  await deleting;
  await rejected;
  expect(await AsyncStorage.getItem(CONVERSATION_KEY)).toBeNull();
});

test('word forms offer explicit last-word alternatives and preserve message punctuation', () => {
  expect(wordFormChoices('I go.')).toContainEqual({ word: 'went', text: 'I went.' });
  expect(wordFormChoices('Go!')).toContainEqual({ word: 'Going', text: 'Going!' });
  expect(wordFormChoices('I go to school')).toEqual([]);
  expect(wordFormChoices('I feel')).toContainEqual({ word: 'felt', text: 'I felt' });
});
