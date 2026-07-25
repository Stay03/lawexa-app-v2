/**
 * Shared row + motion primitives for v2 list surfaces.
 *
 * WAS the home's "module" design system (owner #38) — a bordered card (`Module`,
 * `ModuleSkeleton`, `ModuleEmpty`, `ModuleError`) with rows inside it. The owner
 * removed the card from the home on July 25 ("i dont like the box"); the home now
 * builds from `designs/sections/HomeSection.tsx`, which draws no container at all.
 *
 * `Module.tsx` is DELETED rather than left dormant — a card component nobody
 * renders is an invitation to render it again and quietly undo the redesign.
 * What survives is what the /conversations LIST page still genuinely uses: the row
 * furniture and the shared motion/format helpers.
 */
export {
  ModuleList,
  ModuleRow,
  RowIconTile,
  CountBadge,
  UnreadDot,
} from './rows';
export { FOCUS_RING, REVEAL, CONTENT_FADE, formatRelativeTime } from './meta';
