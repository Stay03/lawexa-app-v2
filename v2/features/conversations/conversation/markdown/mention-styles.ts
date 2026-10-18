/**
 * The look an answer's document links share: a case's and a statute's badge
 * (Arthur, 18 October 2026: statute references get "the preview pane, the
 * stuff that shows when you hover over the badge", as a case's do).
 *
 * v1's global `.case-mention` rule (unlayered, so it beats Tailwind's layer)
 * makes the link an inline-flex box with nowrap: a long case name cannot wrap
 * and runs off a phone screen. The `!` utilities let it wrap like text, and
 * box-decoration-clone keeps the tinted pill on each line it spans.
 */
export const MENTION_TRIGGER_CLASS =
  'case-mention inline! whitespace-normal! box-decoration-clone v2-interactive text-primary focus-visible:ring-ring focus-visible:ring-offset-background -mx-0.5 rounded-sm px-0.5 font-medium transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';

/** Shared width cap: ~450px, but never wider than the viewport minus the
 *  collision padding (16px each side), so it fits a 320px screen. */
export const MENTION_CONTENT_WIDTH = 'w-[min(28rem,calc(100vw-2rem))]';

/** The pane's footer action ("Open case", "Go to section 18"). */
export const MENTION_FOOTER_CLASS =
  'text-primary border-border v2-interactive focus-visible:ring-ring flex min-h-11 w-full items-center justify-between gap-2 border-t px-4 py-2.5 text-left text-xs font-medium transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset';
