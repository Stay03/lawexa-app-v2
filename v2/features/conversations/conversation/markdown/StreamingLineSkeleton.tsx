'use client';

/**
 * StreamingLineSkeleton — the stand-in for the line that is still arriving, shown
 * only in the `line` streaming style.
 *
 * DELIBERATELY CONSTANT. The bar has ONE fixed width (62%) and never varies. It is
 * tempting to predict the incoming line's length and size the bar to match, and it
 * is wrong twice over: a bar that resizes as the line arrives is jitter, and a
 * random width per line reads as noise rather than as structure. A single steady
 * placeholder is what makes the release rhythm legible.
 *
 * PLACEMENT — it must sit WHERE THE NEXT LINE WILL APPEAR. It renders as the last
 * child INSIDE the prose container (see `MarkdownText`'s `showLineSkeleton`), not as
 * a sibling of it: as a sibling it inherited the answer wrapper's `space-y-3` AND sat
 * below the last paragraph's bottom margin, so it hovered ~28px under the text and
 * visibly hopped down on every release instead of being replaced in place. Inside the
 * container, the `v2-stream-line` rule in `shell.css` cancels exactly the preceding
 * paragraph's bottom margin (`p + .v2-stream-line`), so after a paragraph the bar
 * occupies the next line's slot; after a heading/list/blockquote no rule applies and
 * the natural block gap is kept — correct, since a new block really does start there.
 *
 * GEOMETRY. The element occupies exactly ONE prose line (`prose-sm`'s paragraph
 * line-height, 1.7142857em), with the bar centred inside it, so the real line
 * replaces it with no layout shift. It lives inside the transcript's measured content
 * subtree, so MessageList's ResizeObserver bottom-follow accounts for its height and
 * the view stays pinned to the true bottom.
 *
 * MOTION. It fades IN on mount (motion-safe). It does NOT fade out: it disappears in
 * the same commit that paints the line it was standing for, so a fade-out would be a
 * ghost bar hanging under finished text. The disappearance is a REPLACEMENT, not a
 * dismissal — the one honest exception to the symmetric-motion rule.
 */
export function StreamingLineSkeleton() {
  return (
    <div
      aria-hidden
      className="v2-stream-line motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      <div className="bg-muted h-2.5 w-[62%] rounded-full motion-safe:animate-pulse" />
    </div>
  );
}
