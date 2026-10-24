/**
 * ScoreRing — the score as a METER, shared by the practice review and the
 * solo quiz results (pulled out of `ResultsSummary` on 21 October 2026 so
 * the two cannot drift).
 *
 * One ratio against a fixed limit (0–100%), so: ONE hue, a filled arc for the
 * value and a lighter step of the SAME hue for the track — never a second
 * colour, and never an auto-scaled arc. The SVG is `aria-hidden` under a real
 * `role="img"` label, so a screen reader hears "Score: 67 percent" rather than
 * a pile of unlabelled circles.
 *
 * THE BIG NUMBER WEARS PLAIN INK, NOT A GRADE COLOUR. Text should never wear
 * the data colour, and banding a score green-vs-red passes a judgement the
 * data does not support — 40% on hard questions is not a failure. The counts
 * beside it say what happened and the reader draws the conclusion.
 * `tabular-nums` is deliberately absent: equal-width digits make a large
 * standalone number look loose.
 *
 * NOTHING ANSWERED SHOWS "—", NOT "0%": no answers means there is no score,
 * and printing 0% would report a failure that never happened.
 */
const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreRing({
  percent,
  empty = false,
  emptyLabel = 'No score',
}: {
  percent: number;
  /** Nothing was answered: draw the track alone and say so. */
  empty?: boolean;
  /** The accessible sentence for the empty ring, in the surface's words. */
  emptyLabel?: string;
}) {
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const rounded = Math.round(clamped);

  return (
    <div
      role="img"
      aria-label={empty ? emptyLabel : `Score: ${rounded} percent`}
      className="relative size-28 shrink-0"
    >
      <svg aria-hidden viewBox="0 0 120 120" className="size-full -rotate-90">
        {/* Track — a lighter step of the SAME hue, never a neutral grey. */}
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          className="stroke-primary/15"
        />
        {empty ? null : (
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            className="stroke-primary"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        )}
      </svg>
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-foreground"
      >
        {empty ? 'None' : `${rounded}%`}
      </span>
    </div>
  );
}
