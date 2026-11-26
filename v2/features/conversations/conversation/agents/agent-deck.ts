import type { ChainNode } from './agent-chain';
import type { AgentLiveStep } from './agent-live-steps';

/**
 * The agent deck's words (Stay, 25 November 2026, 22:48Z, thread 694678cf:
 * round 9, version 1). Under the turn that asked them: Lawexa's own line on
 * top, then one card per agent it asked, each helper's card slid out under its
 * asker's. A card shows ONE short status line, never the agent's own text; it
 * turns green with a few words of its reply when done. Once every agent of the
 * turn has finished, the deck folds to one line ("5 agents replied · Show").
 * Pure, so the words are tested.
 */

/** What a card's line looks like: gold while it works, quiet while it waits or stopped, green when done. */
export type CardTone = 'working' | 'waiting' | 'done' | 'quiet' | 'failed';

export interface CardStatus {
  words: string;
  tone: CardTone;
}

/** What the agent's live stream has shown so far: its lookups, and whether its reply has started. */
export interface CardLive {
  steps: readonly AgentLiveStep[];
  writing: boolean;
}

/** A lookup in the card's words: what it does, and the one thing it does it for. */
export type StepWords = (step: AgentLiveStep) => { action: string; detail?: string };

/** The longest status line; a longer one is cut at a word. */
const MAX_WORDS_CHARS = 48;

/** "for \"data breach damages\"" → "data breach damages": the card keeps the thing, not the grammar. */
export function stepSubject(detail: string | undefined): string | null {
  if (!detail) return null;
  const plain = detail.replace(/^(for|from|in|of|on)\s+/i, '').replace(/^["“'](.*)["”']$/, '$1').trim();
  return plain || null;
}

function cut(words: string): string {
  if (words.length <= MAX_WORDS_CHARS) return words;
  const head = words.slice(0, MAX_WORDS_CHARS);
  const space = head.lastIndexOf(' ');
  return `${(space > 20 ? head.slice(0, space) : head).trimEnd()}…`;
}

/**
 * A working agent's line, from its stream: the lookup it runs ("Searching
 * cases · data breach"), else the last one it finished with how many things
 * came back ("Searched cases: 3 results"), else "Writing its reply" once its
 * words stream (the words themselves are never shown), else "Reading the
 * question" before it has done anything.
 */
export function workingWords(live: CardLive | null, wordsOf: StepWords): string {
  const steps = live?.steps ?? [];
  const open = [...steps].reverse().find((step) => !step.done);
  if (open) {
    const { action, detail } = wordsOf(open);
    const subject = stepSubject(detail);
    return cut(subject ? `${action} · ${subject}` : action);
  }
  if (live?.writing) return 'Writing its reply';
  const last = steps[steps.length - 1];
  if (last) {
    const { action } = wordsOf(last);
    const count = last.resultCount;
    return cut(count === null ? action : `${action}: ${count} ${count === 1 ? 'result' : 'results'}`);
  }
  return 'Reading the question';
}

/** A card's line for its agent's state. */
export function cardStatus(node: Pick<ChainNode, 'state' | 'replySummary' | 'waitingFor'>, live: CardLive | null, wordsOf: StepWords): CardStatus {
  switch (node.state) {
    case 'running':
      return { words: workingWords(live, wordsOf), tone: 'working' };
    case 'waiting':
      return { words: node.waitingFor ? `With ${node.waitingFor}` : 'Waiting for its helper', tone: 'waiting' };
    case 'replied':
      return { words: node.replySummary ?? 'Replied', tone: 'done' };
    case 'stopped':
      return { words: 'Stopped', tone: 'quiet' };
    case 'failed':
      return { words: 'Couldn’t reply', tone: 'failed' };
  }
}

/** Whether an agent has finished, one way or another. */
export function settled(node: Pick<ChainNode, 'state'>): boolean {
  return node.state === 'replied' || node.state === 'stopped' || node.state === 'failed';
}

const agents = (n: number) => `${n} ${n === 1 ? 'agent' : 'agents'}`;

/**
 * Lawexa's own line over the deck while it works: "5 agents at work" while
 * none has finished, "Waiting for Issue Spotter" for the last one, "Waiting
 * for 3 agents" between. Held messages are counted on the same line.
 */
export function deckLine(rows: readonly Pick<ChainNode, 'state' | 'name'>[], held = 0): string {
  const open = rows.filter((row) => !settled(row));
  const base =
    open.length === rows.length && rows.length > 1
      ? `${agents(rows.length)} at work`
      : open.length === 1
        ? `Waiting for ${open[0].name}`
        : `Waiting for ${agents(open.length)}`;
  return held === 0 ? base : `${base} · ${held} ${held === 1 ? 'message' : 'messages'} queued`;
}

/**
 * The folded line once all have finished: "5 agents replied"; "2 agents
 * stopped" when the person stopped them all; else how many replied of how many.
 */
export function foldLine(rows: readonly Pick<ChainNode, 'state'>[]): string {
  const replied = rows.filter((row) => row.state === 'replied').length;
  if (replied === rows.length) return `${agents(rows.length)} replied`;
  if (rows.every((row) => row.state === 'stopped')) return `${agents(rows.length)} stopped`;
  return `${replied} of ${agents(rows.length)} replied`;
}

/** The earliest call in the deck: the clock on Lawexa's line counts from it. Null when none says. */
export function deckStartedAt(rows: readonly Pick<ChainNode, 'calledAt'>[]): number | null {
  const times = rows.map((row) => (row.calledAt ? Date.parse(row.calledAt) : Number.NaN)).filter((time) => Number.isFinite(time));
  return times.length ? Math.min(...times) : null;
}

/** "0:07", "1:42", "12:05"; past an hour "1:02:05". */
export function elapsedWords(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const two = (n: number) => String(n).padStart(2, '0');
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds % 60)}` : `${minutes}:${two(seconds % 60)}`;
}

