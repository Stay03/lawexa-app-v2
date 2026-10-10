import { cn } from '@/lib/utils';

/* The rules behind StepCollapse (step-collapse.tsx), kept in a .ts file so the
 * tests can load them: Node's type stripping does not read .tsx. */

/** Whether the body is mounted in a render: opening mounts it; closing leaves it for the transition. */
export function bodyMountedOnRender(mounted: boolean, open: boolean): boolean {
  return mounted || open;
}

/** Whether the body stays mounted once a height transition ends: only while open. */
export function bodyMountedAfterTransition(mounted: boolean, open: boolean): boolean {
  return mounted && open;
}

/**
 * The region's classes: height by `grid-template-rows` (no measuring). Reduced
 * motion keeps a 1 ms transition rather than none, so `transitionend` still
 * fires and a closed body still unmounts.
 */
export function stepCollapseClass(open: boolean): string {
  return cn(
    'grid transition-[grid-template-rows] duration-200 motion-reduce:duration-[1ms]',
    open ? 'grid-rows-[1fr] ease-out' : 'grid-rows-[0fr] ease-in',
  );
}
