/**
 * The shared home-module design system (owner #38). One import surface for both
 * the Work and Study tabs — see Module.tsx for the researched design principles.
 */
export {
  Module,
  ModuleSkeleton,
  ModuleEmpty,
  ModuleError,
} from './Module';
export {
  ModuleList,
  ModuleRow,
  RowIconTile,
  CountBadge,
  UnreadDot,
} from './rows';
export { FOCUS_RING, REVEAL, CONTENT_FADE, formatRelativeTime } from './meta';
