'use client';

import { useId } from 'react';
import { GraduationCap, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { FOCUS_RING } from '../modules';

/**
 * Study-mode entry (owner #34). In v1 `study_mode` is a composer-level toggle
 * shown ONLY to students (`user.profile.profession === 'student'`) that flips the
 * turn into study mode on create (studied first-hand in `app/(main)/page.tsx`:
 * `isStudent && <Switch checked={studyMode} … />`, sending `study_mode: true`).
 *
 * The Study tab surfaces that toggle as a MODULE CTA (`StudyModeCard`) and marks
 * the composer with a quiet status pill (`StudyModeChip`) when it is on — the same
 * split v1 uses for confidential mode (toggle in one place, a heading/marker
 * elsewhere). The real network wiring (sending `study_mode: true` on submit) lands
 * with the phase-3 chat wave; here the state is honest LOCAL state — the toggle
 * genuinely flips the composer's visible mode, no dead control. The
 * student-gating is applied by StudyHome (the sanctioned `authStore` profile read),
 * so these components stay presentational.
 *
 * HomeComposer is shared and boundary-frozen (no seam for an internal chip), so the
 * marker is presented adjacent to the composer as a module-level state.
 */

/**
 * The toggle CTA. The label is associated with the Switch (`htmlFor`) so the whole
 * text target flips it; the active state tints the card with a smooth,
 * `motion-reduce`-guarded transition (never a hard swap).
 */
export function StudyModeCard({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  const switchId = useId();

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3.5 transition-colors duration-200 ease-out motion-reduce:transition-none',
        checked ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-200 motion-reduce:transition-none',
          checked ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        <GraduationCap className="size-5" />
      </span>

      <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer select-none">
        <span className="block text-sm font-medium text-foreground">Study mode</span>
        <span className="block text-xs text-muted-foreground">
          Turn answers into guided, step-by-step learning.
        </span>
      </label>

      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label="Study mode"
        className="shrink-0"
      />
    </div>
  );
}

/**
 * The composer's active-state marker. A persistent-node collapse (grid-rows
 * 0fr↔1fr + opacity) so it animates BOTH directions symmetrically (owner #24) —
 * it fades WHILE the row expands/collapses, never a keyed enter-only pop. Gold is
 * confined to the icon; the label stays `text-foreground` so small text stays
 * contrast-safe. When collapsed the content is inert (aria-hidden +
 * pointer-events-none + the clear button drops out of the tab order).
 */
export function StudyModeChip({
  active,
  onClear,
}: {
  active: boolean;
  onClear: () => void;
}) {
  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
        active ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="overflow-hidden">
        <div
          aria-hidden={!active}
          className={cn(
            'mb-2 flex items-center transition-opacity duration-200 ease-out motion-reduce:transition-none',
            active ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 py-1 pl-2.5 pr-1 text-xs font-medium text-foreground">
            <GraduationCap className="size-3.5 shrink-0 text-primary" aria-hidden />
            Study mode
            <button
              type="button"
              onClick={onClear}
              tabIndex={active ? 0 : -1}
              aria-label="Turn off study mode"
              className={cn(
                'v2-interactive rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground',
                FOCUS_RING,
              )}
            >
              <X className="size-3.5" />
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
