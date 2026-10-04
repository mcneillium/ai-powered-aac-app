// Account deletion must drain earlier sync writes before removing their data.
// A failed deletion stays paused until a new sign-in, so retries cannot race
// background writers recreating data that was already removed.
let paused = false;
let generation = 0;
const pending = new Set();
const stoppers = new Set();

export function isAccountDeletionPaused() { return paused; }
export function accountDataGeneration() { return generation; }

export function trackAccountDataOperation(operation) {
  const promise = Promise.resolve(operation);
  pending.add(promise);
  promise.then(() => pending.delete(promise), () => pending.delete(promise));
  return promise;
}

export function registerAccountDeletionStopper(stop) {
  stoppers.add(stop);
  return () => stoppers.delete(stop);
}

export async function beginAccountDeletion() {
  paused = true;
  generation += 1;
  const stopped = await Promise.allSettled([...stoppers].map(stop => Promise.resolve().then(stop)));
  // A completing operation can start another tracked write. Drain until no
  // earlier operation remains; new public mutations must check paused first.
  while (pending.size) await Promise.allSettled([...pending]);
  if (stopped.some(result => result.status === 'rejected')) {
    throw new Error('Could not pause account data operations.');
  }
}

export function resumeAccountDataSync() {
  paused = false;
  generation += 1;
}
