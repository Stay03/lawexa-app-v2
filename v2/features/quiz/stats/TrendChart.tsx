import { formatSessionDate } from '@/lib/utils/quiz-format';
import type { QuizScoreTrendPoint } from '@/types/quiz';

/**
 * TrendChart — the last ten finished sessions' scores, oldest to newest.
 *
 * ── WHAT MAKES IT HONEST ────────────────────────────────────────────────────
 *  1. THE X AXIS IS SESSION ORDER, AND IT SAYS SO. The points are evenly
 *     spaced because they are a SEQUENCE, not a time series: two sessions an
 *     hour apart and two a month apart look identical on this axis. v1 fed the
 *     `completed_at` timestamps to a categorical axis and printed dates under
 *     evenly-spaced ticks, which claims a time scale the chart does not have.
 *     Here only the two ENDS are dated, the caption states the ordering, and
 *     every point's real date lives in its tooltip and in the table twin.
 *  2. THE Y AXIS IS PINNED 0–100. A score is a percentage of a fixed whole, so
 *     auto-scaling to the data range would turn a 62→68 wobble into a cliff.
 *  3. STRAIGHT SEGMENTS, NOT A SMOOTHED CURVE. v1 used `type="monotone"`, which
 *     invents values between points; there is nothing between two sessions.
 *  4. ONE HUE. A single series needs no legend (the heading names it) and no
 *     categorical palette.
 *
 * ── EVERY VALUE IS REACHABLE WITHOUT A MOUSE ────────────────────────────────
 * A tooltip may enhance a chart, never gate it. So each point is a real
 * `<button>` with an accessible label, its tooltip opens on hover AND on
 * keyboard focus through the same CSS, the hit area is 24px around an 8px dot,
 * and a visually-hidden TABLE carries the whole series for assistive tech. The
 * endpoint is direct-labelled once, in the card's header row — selective
 * labelling, and it cannot collide with the plot.
 *
 * ── WHY IT IS HAND-DRAWN ────────────────────────────────────────────────────
 * Ten points, one series, a fixed axis. Recharts (already a dependency) would
 * add a chart runtime and then have to be argued out of its defaults — the
 * smoothing, the auto domain, the categorical date axis — every one of which is
 * a decision above. Plain SVG plus positioned marks is smaller and is exactly
 * what was designed. It also needs no hooks, so it stays a plain presentational
 * module that any tree can render (in practice its data arrives from a client
 * query, so it renders in the browser).
 */

/** Plot geometry, in the SVG's own 0–100 user units. The horizontal inset
 *  keeps the first and last dots — and their tooltips — off the card edge. */
const X_MIN = 6;
const X_MAX = 94;

/** The gridlines, as percentages of the plot height. */
const Y_TICKS = [100, 50, 0] as const;

export function TrendChart({ data }: { data: QuizScoreTrendPoint[] }) {
  // Guaranteed by the caller (a single point is not a trend), but the maths
  // below divides by `length - 1`, so the guard stays local as well.
  if (data.length < 2) return null;

  const points = data.map((point, index) => ({
    ...point,
    x: X_MIN + (index / (data.length - 1)) * (X_MAX - X_MIN),
    y: 100 - Math.min(100, Math.max(0, point.score_percentage)),
  }));

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ');
  const area = `${line} L${X_MAX},100 L${X_MIN},100 Z`;

  const first = data[0];
  const last = data[data.length - 1];

  return (
    <figure className="m-0">
      <div className="flex gap-2">
        {/* Y axis — three labelled steps, the values the marks are read
            against. Tabular figures here because they DO align vertically. */}
        <div
          aria-hidden
          className="relative h-40 w-7 shrink-0 text-[10px] tabular-nums text-muted-foreground/70"
        >
          {Y_TICKS.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${100 - tick}%` }}
            >
              {tick}%
            </span>
          ))}
        </div>

        <div className="relative h-40 flex-1">
          {/* Gridlines — solid hairlines, one step off the surface, never
              dashed (a dashed grid reads as a threshold or a projection). */}
          {Y_TICKS.map((tick) => (
            <span
              key={tick}
              aria-hidden
              className="absolute inset-x-0 border-t border-border/60"
              style={{ top: `${100 - tick}%` }}
            />
          ))}

          <svg
            aria-hidden
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 size-full overflow-visible"
          >
            {/* A wash, never a saturated block. */}
            <path d={area} className="fill-primary/10" />
            {/* `non-scaling-stroke` keeps this a true 2px line at every width —
                the viewBox is stretched, the stroke is not. */}
            <path
              d={line}
              fill="none"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              className="stroke-primary"
            />
          </svg>

          {/* Marks + hit targets as positioned HTML, so the dots stay circular
              under the stretched viewBox and the hit area can be a real 24px
              control rather than an 8px pinpoint. */}
          {points.map((point, index) => (
            <button
              key={`${point.completed_at}-${index}`}
              type="button"
              // A button that only reveals its own label: pressing it does
              // nothing, which is correct — hover and focus are the interaction.
              aria-label={`Session ${index + 1} of ${points.length}, ${formatSessionDate(point.completed_at)}: ${Math.round(point.score_percentage)} percent`}
              className="group absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
            >
              {/* The dot, with the 2px surface ring that keeps it legible
                  where it crosses the line. */}
              <span
                aria-hidden
                className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-background transition-transform group-hover:scale-150 group-focus-visible:scale-150 motion-reduce:transition-none"
              />
              {/* Tooltip — opens identically on hover and on keyboard focus. */}
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] tabular-nums text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              >
                {formatSessionDate(point.completed_at)} ·{' '}
                {Math.round(point.score_percentage)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* X axis — only the two ends are dated, because only the two ends have
          an honest position on an ordinal axis. */}
      <div
        aria-hidden
        className="mt-2 flex justify-between pl-9 text-[10px] text-muted-foreground/70"
      >
        <span>{formatSessionDate(first.completed_at)}</span>
        <span>{formatSessionDate(last.completed_at)}</span>
      </div>

      {/* The table twin — every value, in order, for assistive tech. */}
      <table className="sr-only">
        <caption>
          Score by session, oldest to newest. Sessions are evenly spaced by
          order, not by date.
        </caption>
        <thead>
          <tr>
            <th scope="col">Session</th>
            <th scope="col">Finished</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point, index) => (
            <tr key={`${point.completed_at}-${index}`}>
              <th scope="row">{index + 1}</th>
              <td>{formatSessionDate(point.completed_at)}</td>
              <td>{Math.round(point.score_percentage)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
