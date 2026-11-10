/**
 * channel-listeners — how many mounted listeners share each private channel
 * (the techlead's recheck, 29 October 2026). A Space's channel carries both its
 * task board (`use-task-board-live.ts`) and its live quiz games
 * (`use-space-quiz-live.ts`), so each stops only its own listeners on unmount,
 * and the last one to go leaves the channel: a Space visited once does not
 * stay subscribed all session. Pure, so the count is a unit test.
 */

const listeners = new Map<string, number>();

/** One more board listens on `name`. Returns how many do now. */
export function retainChannel(name: string): number {
  const count = (listeners.get(name) ?? 0) + 1;
  listeners.set(name, count);
  return count;
}

/** One board stopped listening on `name`. Returns how many still do; at 0
 *  the caller leaves the channel. */
export function releaseChannel(name: string): number {
  const count = Math.max(0, (listeners.get(name) ?? 0) - 1);
  if (count === 0) listeners.delete(name);
  else listeners.set(name, count);
  return count;
}
