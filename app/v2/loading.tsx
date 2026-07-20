/**
 * Route-level loading boundary for the v2 root (`/` — the home). SKELETON, never
 * text (owner report item 5: the old "Loading…" string violated the standing
 * skeleton-first rule — placeholder strings are banned; it predated the rule).
 * Geometry approximates the home's compose cluster (greeting line → composer
 * card → prompt rows) so the hand-off to the real page reads as content
 * resolving into place, not a layout swap. Purely decorative.
 */
export default function V2Loading() {
  return (
    <div
      aria-hidden
      className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-6 px-6 pb-24"
    >
      <div className="bg-muted h-8 w-56 animate-pulse rounded-lg" />
      <div className="border-border bg-muted/50 h-[110px] w-full animate-pulse rounded-3xl border" />
      <div className="space-y-3">
        <div className="bg-muted h-4 w-3/5 animate-pulse rounded" />
        <div className="bg-muted h-4 w-1/2 animate-pulse rounded" />
        <div className="bg-muted h-4 w-2/5 animate-pulse rounded" />
      </div>
    </div>
  );
}
