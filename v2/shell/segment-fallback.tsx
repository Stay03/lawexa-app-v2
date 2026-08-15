/**
 * SegmentFallback — the neutral loading boundary, written once.
 *
 * ── WHAT "NEUTRAL" MEANS AND WHY IT IS EMPTY ───────────────────────────────
 * A segment's `loading.tsx` wraps its CHILD SLOT, not its own page. When the
 * children of a segment do not share a shape, the boundary cannot paint any of
 * them without being wrong for the others — so it paints nothing. The
 * persistent shell (header, sidebar, dock) already frames the wait, and the
 * destination's own boundary takes over the moment its shell arrives. A quiet
 * beat is honest where a silhouette would be a lie about where the reader is
 * going.
 *
 * ── WHY IT IS A COMPONENT AND NOT SIX COPIES ───────────────────────────────
 * Six segments need this exact markup: the v2 root, and `cases`, `statutes`,
 * `notes`, `folders` and `radars`, each of which mixes a document, a list and
 * sometimes a form under one segment. Six byte-identical copies is a set that
 * reads as a set only until somebody tunes one of them.
 *
 * ── THE LABEL IS NOT DECORATION ────────────────────────────────────────────
 * `role="status"` with a section-specific line is what a screen-reader user
 * gets INSTEAD of the silhouette a sighted reader is deliberately not being
 * shown. It is also what makes these states measurable: each fallback in the
 * app announces itself with a distinct line, so the sequence of announcements
 * IS the loading chain, readable by a test. That is how the "wrong skeleton,
 * then another skeleton" fault was finally caught on 15 August after being
 * declared fixed twice — by recording the announcements across a section
 * switch rather than by reading a docblock.
 */
export function SegmentFallback({ label }: { label: string }) {
  return (
    <>
      <span role="status" className="sr-only">
        {label}
      </span>
      <div aria-hidden className="min-h-full" />
    </>
  );
}
