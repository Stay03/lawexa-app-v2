import { LIST_COLUMN } from '@/v2/shell/page-columns';

/**
 * Route fallback for `/radars/new` — the form's resting silhouette, held
 * STILL (standards §8i: nothing is in flight behind a static form, so nothing
 * may pulse). Geometry mirrors `CreateRadarScreen`: heading block, two field
 * groups, the schedule fieldset, the options fold, the switch card, and the
 * submit row.
 *
 * THE BACK LINK'S BAR HAS GONE FROM HERE TOO (phase 7). The way back moved into
 * the shell's header, which is painted by the shell and is therefore already on
 * screen while this boundary shows — reserving a second one would have drawn a
 * strip the live screen no longer has. The heading bar is `md:` and up for the
 * same reason: below that width the title is in the bar.
 */
export default function NewRadarLoading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading the radar form
      </span>
      <div aria-hidden inert className={LIST_COLUMN}>
        <div className="mb-6 space-y-2 md:mt-4">
          <div className="hidden h-6 w-36 rounded-lg bg-secondary/60 md:block" />
          <div className="h-4 w-72 max-w-full rounded bg-secondary/40" />
        </div>
        <div className="space-y-7">
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-secondary/60" />
            <div className="grid items-start gap-3 sm:grid-cols-[2fr_3fr]">
              <div className="h-11 rounded-xl border border-input bg-input/30" />
              <div className="h-11 rounded-xl border border-input bg-input/30" />
            </div>
          </div>
          <div className="space-y-3">
            <div className="h-4 w-20 rounded bg-secondary/60" />
            <div className="h-9 w-72 max-w-full rounded-full bg-secondary/60" />
            <div className="h-4 w-64 max-w-full rounded bg-secondary/40" />
          </div>
          <div className="h-12 rounded-xl border border-border" />
          <div className="h-28 rounded-xl border border-border" />
          <div className="flex justify-end">
            <div className="h-9 w-32 rounded-md bg-secondary/60" />
          </div>
        </div>
      </div>
    </>
  );
}
