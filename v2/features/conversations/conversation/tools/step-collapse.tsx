'use client';

import { useState, type ReactNode, type TransitionEvent } from 'react';
import { bodyMountedAfterTransition, bodyMountedOnRender, stepCollapseClass } from './step-collapse-rules';

/**
 * StepCollapse — the open/close region under one tool step (10 October 2026).
 *
 * WHY NOT RADIX: a Radix `CollapsibleContent` stays mounted while closed and
 * measures itself (`getBoundingClientRect`) in a layout effect on mount. A
 * long chat mounts 18 closed steps at once, and the CPU profile of a cold open
 * put 432 ms of style recalcs on those reads and pulled the transcript's first
 * layout (913 ms) into the commit, before the answer could paint.
 *
 * HOW: the height animates with `grid-template-rows: 0fr ↔ 1fr`, the same
 * technique as the chain's "show all" region in CompactToolChain. The browser
 * resolves the height, so nothing is measured. The grid wrapper is always
 * rendered (an empty div while closed) so the class change can transition; the
 * body mounts when the step opens and unmounts when the close transition ends.
 * Reduced motion keeps a 1 ms transition rather than none, so `transitionend`
 * still fires and the body still unmounts.
 */
export function StepCollapse({
  id,
  open,
  children,
}: {
  /** Referenced by the step button's `aria-controls`. */
  id: string;
  open: boolean;
  children: ReactNode;
}) {
  const [bodyMounted, setBodyMounted] = useState(open);
  // Opening mounts the body in the same render that starts the transition.
  // A state update during render (not in an effect) so the first open frame
  // already has the body.
  const mountedNow = bodyMountedOnRender(bodyMounted, open);
  if (mountedNow !== bodyMounted) setBodyMounted(mountedNow);

  const onTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    setBodyMounted((mounted) => bodyMountedAfterTransition(mounted, open));
  };

  return (
    <div
      id={id}
      inert={!open || undefined}
      onTransitionEnd={onTransitionEnd}
      className={stepCollapseClass(open)}
    >
      <div className="min-h-0 overflow-hidden">{mountedNow && children}</div>
    </div>
  );
}
