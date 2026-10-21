import type { ToolMessage } from '@/types/chat';

/* The folded tool chain's summary line, in a .ts file so the tests can load it
 * (Node's type stripping does not read .tsx). */

/**
 * "N tool calls completed", counting every step that has finished, the newest
 * one included. It used to count only the steps folded away above the newest
 * one, so a chain of 4 finished steps read "3 tool calls completed" and then
 * opened to 4 (Tester, 20 October 2026, finding 5). While the newest step is
 * still running, it is the one not counted, and it shows its own spinner below.
 */
export function chainSummaryLabel(messages: readonly Pick<ToolMessage, 'toolStatus'>[]): string {
  const done = messages.filter((message) => message.toolStatus === 'complete').length;
  return `${done} tool ${done === 1 ? 'call' : 'calls'} completed`;
}
