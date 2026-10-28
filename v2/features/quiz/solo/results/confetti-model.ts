/**
 * The confetti of the podium moment (Arthur, 28 October 2026: "isn't
 * celebratory enough ... a confetti explosion like Kahoot as the podium
 * appears"): paper bits burst up and out from one point, slow in the air,
 * and flutter down off the bottom of the screen in about two and a half
 * seconds. Pure, so the timing is tested without a browser; `Confetti.tsx`
 * draws it on a canvas.
 */

export interface ConfettiPiece {
  x: number;
  y: number;
  /** Pixels per second. */
  vx: number;
  vy: number;
  /** Radians, and radians per second. */
  angle: number;
  spin: number;
  width: number;
  height: number;
  color: string;
  /** A round dot rather than a paper strip. */
  round: boolean;
}

/** Lawexa's gold first, then the podium's blue and peach, and a few brighter ones. */
export const CONFETTI_COLORS = ['#d9a400', '#f2c94c', '#9db2ec', '#f4a582', '#e8664a', '#3baa7a', '#b98cf0'] as const;

export const CONFETTI_COUNT = 140;
/** Pulls everything down (px/s²). */
const GRAVITY = 1500;
/** Paper does not fall faster than this (px/s): the flutter. */
const TERMINAL_FALL = 620;
/** How much sideways speed the air takes each second. */
const AIR_DRAG = 1.6;
/** Never longer than this, whatever the screen. */
export const CONFETTI_MAX_MS = 3200;

/**
 * One burst from `origin`: up and out in a fan around straight up, gold the
 * most common colour. `random` is injected so a test can seed it.
 */
export function burstConfetti(
  origin: { x: number; y: number },
  random: () => number = Math.random,
  count: number = CONFETTI_COUNT,
): ConfettiPiece[] {
  return Array.from({ length: count }, (_, index) => {
    const spread = (random() - 0.5) * (Math.PI * 0.85);
    const direction = -Math.PI / 2 + spread;
    const speed = 520 + random() * 620;
    // Every third piece gold, so the burst reads as Lawexa's.
    const color = index % 3 === 0 ? CONFETTI_COLORS[0] : CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)];
    return {
      x: origin.x,
      y: origin.y,
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      angle: random() * Math.PI * 2,
      spin: (random() - 0.5) * 14,
      width: 6 + random() * 5,
      height: 3 + random() * 4,
      color,
      round: random() < 0.2,
    };
  });
}

/** Moves every piece on by `ms`, in place. */
export function stepConfetti(pieces: ConfettiPiece[], ms: number): void {
  const seconds = Math.min(ms, 64) / 1000;
  const drag = Math.exp(-AIR_DRAG * seconds);
  for (const piece of pieces) {
    piece.vx *= drag;
    piece.vy = Math.min(piece.vy + GRAVITY * seconds, TERMINAL_FALL);
    piece.x += piece.vx * seconds;
    piece.y += piece.vy * seconds;
    piece.angle += piece.spin * seconds;
  }
}

/** Over when every piece has left the bottom of the screen, or the time is up. */
export function confettiDone(pieces: readonly ConfettiPiece[], screenHeight: number, elapsedMs: number): boolean {
  if (elapsedMs >= CONFETTI_MAX_MS) return true;
  return pieces.every((piece) => piece.y > screenHeight + 16);
}
