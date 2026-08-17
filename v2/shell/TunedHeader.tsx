'use client';

import type { ReactNode } from 'react';

import { barTuningStyle, useBarTuning } from '../bar-tuning';

/**
 * The shell's header element, with the top-bar treatment applied.
 *
 * ── WHY THIS IS ITS OWN FILE ───────────────────────────────────────────────
 * `AppShell` is a server component and must stay one: it is the frame every v2
 * route renders inside, and making it client would drag the whole shell into
 * the browser bundle to satisfy one attribute. So the ONE element that reads a
 * browser-only preference is lifted out, and everything around it is unchanged.
 *
 * The `header` slot is still passed straight through as children, so this adds
 * a client boundary and not a re-render of the bar's contents.
 *
 * ── IT RENDERS THE SHIPPED TREATMENT UNTIL TOLD OTHERWISE ──────────────────
 * `useBarTuning` answers with the shipped default on the server and on the
 * first client render, so there is no flash and no hydration mismatch. Only an
 * account that has actually moved a slider in developer settings ever sees
 * anything else — see `bar-tuning.ts` for why this exists at all, and why it is
 * expected to be deleted once the owner decides.
 */
export function TunedHeader({ children }: { children: ReactNode }) {
  const tuning = useBarTuning();

  return (
    <header
      className="v2-shell__header"
      /* `none` matches no rule in `shell.css`, which is how "no strip at all"
         is expressed without a fourth code path. */
      data-v2-bar-treatment={tuning.treatment}
      style={barTuningStyle(tuning)}
    >
      {children}
    </header>
  );
}
