import { useSyncExternalStore } from 'react';

/**
 * The find's hidden readout (Arthur picked A, 26 October 2026, thread "Push:
 * iPhone draft fixes"): on his iPhone the find's count moves but the draft
 * does not scroll to the match, and no browser here shows it. With
 * `?finddebug=1` in the address, every jump to a match records what the
 * scroll saw and did, and FindDebugPanel shows the last three at the top of
 * the screen. Without the flag nothing is measured and nothing is drawn.
 */

export interface FindDebugStep {
  id: number;
  /** "3 of 6", or "no match drawn" when the current match had no element. */
  count: string;
  /** The match's box on screen, "top-bottom". */
  match: string;
  /** The element that was scrolled ("draft" is the draft's own scroll area), or "none". */
  area: string;
  /** Its scrollTop before the set, the value set, read back at once, and read again 300 ms later. */
  before: number | null;
  set: number | null;
  readBack: number | null;
  later: number | null;
  /** Its scrollHeight / clientHeight. */
  size: string;
  /** visualViewport height@offsetTop, innerHeight, scrollY. */
  viewport: string;
  /** What has focus: the find box, or something else. */
  focus: string;
}

/** How long after the set the scroll is read again: anything that scrolls it back shows here. */
export const FIND_DEBUG_LATER_MS = 300;

let enabled: boolean | null = null;

/** This tab's mark that the readout was asked for, so it survives the address changing (a draft opening). */
const SESSION_KEY = 'lawexa-finddebug';

/**
 * `?finddebug=1` (any value) in the address, now or earlier in this tab.
 * Read once per page load. Opening a draft rewrites the address, so the flag
 * is also kept in sessionStorage for the tab once it has been seen.
 */
export function findDebugEnabled(): boolean {
  if (enabled !== null) return enabled;
  if (typeof window === 'undefined') return false;
  const asked = new URLSearchParams(window.location.search).has('finddebug');
  try {
    if (asked) window.sessionStorage.setItem(SESSION_KEY, '1');
    enabled = asked || window.sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    enabled = asked;
  }
  return enabled;
}

let steps: readonly FindDebugStep[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

/** Keeps the newest three steps, newest first. */
export function keepLastSteps(list: readonly FindDebugStep[], step: FindDebugStep): FindDebugStep[] {
  return [step, ...list].slice(0, 3);
}

export function recordFindStep(step: Omit<FindDebugStep, 'id'>): number {
  const id = nextId++;
  steps = keepLastSteps(steps, { ...step, id });
  notify();
  return id;
}

export function updateFindStep(id: number, patch: Partial<FindDebugStep>): void {
  steps = steps.map((step) => (step.id === id ? { ...step, ...patch } : step));
  notify();
}

/** One line for a step, as the panel prints it. */
export function findStepLine(step: FindDebugStep): string {
  const scroll = step.set === null ? 'no set' : `st ${step.before}→set ${step.set}→read ${step.readBack}→${FIND_DEBUG_LATER_MS}ms ${step.later ?? '…'}`;
  return `${step.count} · m ${step.match} · ${step.area} ${scroll} · sh/ch ${step.size} · ${step.viewport} · focus ${step.focus}`;
}

/** A short name for an element: draft, its id, a tag and the find box's label. */
export function describeElement(element: Element | null): string {
  if (!element) return 'none';
  if (element.hasAttribute('data-v2-draft-scroll')) return 'draft';
  if (element === document.scrollingElement) return 'document';
  const label = element.getAttribute('aria-label');
  if (element.id) return `#${element.id}`;
  return `${element.tagName.toLowerCase()}${label ? `[${label}]` : ''}`;
}

/** The viewport numbers, as one short string. */
export function viewportLine(): string {
  const viewport = window.visualViewport;
  const visual = viewport ? `vv ${Math.round(viewport.height)}@${Math.round(viewport.offsetTop)}` : 'vv none';
  return `${visual} ih ${window.innerHeight} sy ${Math.round(window.scrollY)}`;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFindDebugSteps(): readonly FindDebugStep[] {
  return useSyncExternalStore(subscribe, () => steps, () => steps);
}

/** Whether the readout is on, as a hook: false on the server, then the address decides. */
export function useFindDebugEnabled(): boolean {
  return useSyncExternalStore(subscribe, findDebugEnabled, () => false);
}
