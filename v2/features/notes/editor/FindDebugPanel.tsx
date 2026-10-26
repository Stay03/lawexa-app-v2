'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

import { findStepLine, useFindDebugEnabled, useFindDebugSteps } from './find-debug';

/**
 * The find's hidden readout (find-debug.ts), shown only with `?finddebug=1`:
 * the last three steps, newest first, in a small strip across the very top
 * of the screen. It sits over the dimmed page above the draft's sheet and at
 * most the sheet's title row, never over the draft text or the find bar. A
 * tap hides it for the rest of the visit.
 */
export function FindDebugPanel() {
  const enabled = useFindDebugEnabled();
  const steps = useFindDebugSteps();
  const [hidden, setHidden] = useState(false);
  if (!enabled || hidden) return null;
  return createPortal(
    <button
      type="button"
      onClick={() => setHidden(true)}
      aria-label="Find readout (tap to hide)"
      className="fixed inset-x-0 top-0 z-[200] block bg-black/85 px-2 pt-[max(0.25rem,env(safe-area-inset-top))] pb-1 text-left font-mono text-[10px] leading-[1.35] text-white"
    >
      {steps.length === 0 ? (
        <span className="block">find readout: press Next</span>
      ) : (
        steps.map((step, position) => (
          <span key={step.id} className="block break-all">
            {position + 1}. {findStepLine(step)}
          </span>
        ))
      )}
    </button>,
    document.body,
  );
}
