/**
 * Which blocks of a landed answer parse in the opening frame, and when the
 * rest follow (MarkdownText).
 *
 * WHY. Opening a chat parsed every block of every drawn answer before the
 * first paint: 822 ms of react-markdown on a long answer, 474 ms of it in the
 * last task before the text showed (phone profile, CPU x4). An open lands at
 * the bottom, so the reader's first screen is the END of the last answer. That
 * end parses first (the eager blocks); the blocks above it draw as muted raw
 * text and all swap to parsed markdown in one transition two frames after the
 * first paint, the same move-first-fill-second pattern MessageList's `showAll`
 * uses for whole messages.
 *
 * NEVER WHILE TEXT IS ARRIVING. A row that mounts streaming (or empty, which
 * is how a streaming row starts) parses every block, so the streaming
 * pipeline is exactly what it was.
 *
 * ONLY WHEN THE OPEN LANDS AT THE BOTTOM. Anywhere else the blocks on screen
 * could be the deferred ones, so the whole answer parses at once.
 */

/** An answer of this many blocks or fewer parses whole. */
export const DEFER_ABOVE_BLOCKS = 8;
/** The eager blocks hold at least this many characters: a phone screen and more. */
export const EAGER_MIN_CHARS = 2_500;
/** ...and at least this many blocks. */
export const EAGER_MIN_BLOCKS = 5;
/**
 * The hard deadline: if the transition swap has not committed this long after
 * the first paint (a busy main thread keeps interrupting it), every remaining
 * block parses at once in an urgent render, so muted raw text never lingers.
 */
export const SWAP_DEADLINE_MS = 1_000;

/**
 * Whether a row mounting now may defer its blocks: only during the open (the
 * first frame and the `showAll` fill after it), only while the reader is
 * still at the bottom the open landed on, and never while a turn runs. A row
 * that mounts later (a reasoning trace opened by hand, a message from another
 * tab) is somewhere the reader is looking, so it parses whole.
 */
export function openDefersBlocks({
  opened,
  scrolledUp,
  turnRunning,
}: {
  opened: boolean;
  scrolledUp: boolean;
  turnRunning: boolean;
}): boolean {
  return !opened && !scrolledUp && !turnRunning;
}

/**
 * The index of the first eager block: blocks before it draw as placeholders
 * until the swap, blocks from it on parse in the opening frame. 0 means
 * nothing is deferred. Read once, when the row mounts.
 */
export function eagerStart(
  blocks: readonly string[],
  { streaming, landsAtBottom }: { streaming: boolean; landsAtBottom: boolean },
): number {
  if (streaming || !landsAtBottom || blocks.length <= DEFER_ABOVE_BLOCKS) return 0;
  let chars = 0;
  for (let index = blocks.length - 1; index > 0; index--) {
    chars += blocks[index].length;
    if (chars >= EAGER_MIN_CHARS && blocks.length - index >= EAGER_MIN_BLOCKS) return index;
  }
  return 0;
}

/** The browser's frame and timer calls, passed in so node:test can drive them. */
export interface FrameTimers {
  requestAnimationFrame: (run: () => void) => number;
  cancelAnimationFrame: (id: number) => void;
  setTimeout: (run: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
}

/**
 * Schedule the swap: two frames after mount (the first runs before the
 * opening frame is painted, the second after it) `swap(false)` asks for the
 * transition, and from that same moment a {@link SWAP_DEADLINE_MS} timer calls
 * `swap(true)` for the urgent render. Returns the cancel; the caller cancels
 * once the swap has committed, which also drops the deadline.
 */
export function scheduleSwap(timers: FrameTimers, swap: (urgent: boolean) => void): () => void {
  let second = 0;
  let deadline = 0;
  const first = timers.requestAnimationFrame(() => {
    second = timers.requestAnimationFrame(() => {
      deadline = timers.setTimeout(() => swap(true), SWAP_DEADLINE_MS);
      swap(false);
    });
  });
  return () => {
    timers.cancelAnimationFrame(first);
    if (second) timers.cancelAnimationFrame(second);
    if (deadline) timers.clearTimeout(deadline);
  };
}
