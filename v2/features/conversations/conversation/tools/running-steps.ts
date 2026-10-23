import type { ToolMessage } from '@/types/chat';

/**
 * running-steps — a step the transcript has stored with no result, in a turn
 * that is still running, is still running.
 *
 * The transcript has no status on a step (backend, 23 October 2026): a
 * `tool_call` message with no `tool_result` after it is all there is, and the
 * transform marks every stored step `complete`. Whether the turn still runs
 * comes from the conversation's status, which the screen follows as
 * `isStreaming`. So in the last group of a running turn, a stored step with no
 * result and nothing to fetch is shown as `calling`: its row reads "Making a
 * quiz" and its card "Making your quiz…", not "stopped". Once the turn ends, the
 * same step reads as stopped (created-quiz.ts).
 */
export function runningSteps(steps: ToolMessage[], turnRunning: boolean): ToolMessage[] {
  if (!turnRunning) return steps;
  const stored = (step: ToolMessage) => step.toolStatus === 'complete' && !step.toolResult && !step.resultRef;
  if (!steps.some(stored)) return steps;
  return steps.map((step) => (stored(step) ? { ...step, toolStatus: 'calling' } : step));
}
