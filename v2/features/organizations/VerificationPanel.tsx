'use client';

import { BadgeCheck, Clock, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Organization } from '@/types/collab';
import { formatRelativeTime } from '@/v2/shell/designs/modules';
import { verificationState } from './model';

/**
 * VerificationPanel — the THREE verification states, preserved exactly as v1
 * designed them (study A8: "well designed — keep them as-is conceptually"),
 * rebuilt on v2 primitives and given a first-class dark rendering.
 *
 *   VERIFIED     an emerald-tinted panel with the date the badge was granted.
 *                Emerald, not our gold: gold is doing unread/mention work
 *                everywhere else in this wave and a second meaning would blunt
 *                it. Not red either — nothing here has failed.
 *   UNDER REVIEW a quiet neutral panel. Nothing is required of the reader, so
 *                nothing about it asks for attention; it says what is
 *                happening and, when the server will tell us, since when.
 *   UNVERIFIED   the only state with an action. A governor gets the button; an
 *                ordinary member gets the same explanation without a control
 *                they cannot use.
 *
 * REACHING "UNDER REVIEW" AT ALL TAKES `justSubmitted`. The payload's
 * `verification_requested_at` is admin-only, so without that flag the person
 * who just uploaded their documents would be sent straight back to "Get
 * verified" — no acknowledgement, and an invitation to submit again. See
 * `verificationState`'s note, and the backend ask recorded there. When the flag
 * is what put the panel in this state there is no timestamp to quote, so the
 * copy does not quote one. Phase-5 W4, 2026-08-04.
 */
/**
 * "3d ago" reads correctly; "now ago" does not. The house relative format
 * returns the bare word `now` for anything under a minute, so the one phrase
 * that would be ungrammatical is spelled out instead. `null` means there is no
 * timestamp to speak about at all.
 */
function agoPhrase(iso: string | null | undefined, now: number): string | null {
  const compact = formatRelativeTime(iso, now);
  if (!compact) return null;
  return compact === 'now' ? 'just now' : `${compact} ago`;
}

/**
 * The state swap is a real transition, not a cut: submitting replaces the
 * "Get verified" panel with "Under review" in the same frame the dialog
 * closes, and a panel that simply appeared there would read as a glitch. One
 * shared entrance so all three states arrive the same way; reduced motion
 * settles straight to visible.
 */
const PANEL_ENTER =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200';

export function VerificationPanel({
  organization,
  canManage,
  now,
  justSubmitted = false,
  onRequest,
}: {
  organization: Organization;
  canManage: boolean;
  /** Frozen clock for the relative dates (React Compiler lint). */
  now: number;
  /** A verification request resolved successfully in this session — today the
   *  only way the SUBMITTER can reach the under-review state. */
  justSubmitted?: boolean;
  onRequest: () => void;
}) {
  const state = verificationState(organization, justSubmitted);

  if (state === 'verified') {
    const since = agoPhrase(organization.verified_at, now);
    return (
      <section
        className={cn(
          'flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4',
          PANEL_ENTER,
        )}
      >
        <BadgeCheck
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400"
        />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Verified organization
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {since
              ? `Confirmed ${since}. The badge shows anywhere ${organization.name} appears.`
              : `The badge shows anywhere ${organization.name} appears.`}
          </p>
        </div>
      </section>
    );
  }

  if (state === 'under-review') {
    const submitted = agoPhrase(organization.verification_requested_at, now);
    return (
      <section
        className={cn(
          'flex items-start gap-3 rounded-xl border bg-secondary/40 p-4',
          PANEL_ENTER,
        )}
      >
        <Clock aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Verification under review
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {submitted
              ? `Submitted ${submitted}. A reviewer checks your documents and the badge appears here when it's approved — nothing else is needed from you.`
              : "A reviewer is checking your documents. The badge appears here when it's approved — nothing else is needed from you."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between',
        PANEL_ENTER,
      )}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck
          aria-hidden
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Get verified</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {canManage
              ? 'Submit your business number and CAC document to earn a verified badge on your organization.'
              : 'An owner or admin can submit this organization’s CAC document to earn a verified badge.'}
          </p>
        </div>
      </div>
      {canManage && (
        <Button size="sm" className="v2-interactive shrink-0" onClick={onRequest}>
          Request verification
        </Button>
      )}
    </section>
  );
}
