'use client';

import Link from 'next/link';
import { ArrowUpRight, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * StatutePaywall — where a partial document's free excerpt ends: a gradient
 * fade over the last lines of OUR rendered text (never fabricated blurred
 * content), then the upgrade card. Rendered ONLY when the export-akn response
 * carried the partial marker — a full document (paid caller, small statute,
 * switch off, headers not exposed) never mounts this at all.
 *
 * ── THE DESIGN, IN THE READING GRAMMAR ──────────────────────────────────────
 * The card stands where the next division heading would stand, and it borrows
 * that grammar deliberately: the gold caps-tracked kicker where a part number
 * would sit, the Fraunces serif headline at the division-heading scale, one
 * quiet sans line (labels and scaffolding never speak serif), then the action.
 * Gold, not red — the same "a limit is an invitation, not a failure" rule the
 * case page's view-limit notice draws. Typography lives in
 * `statute-document.css` (`.akn-paywall-*`), structure lives here.
 *
 * ── THE VIEWER-AWARE ACTION ─────────────────────────────────────────────────
 * Only two viewers can ever see this (signed-out visitors are gated off the
 * reader entirely, and paid readers get no marker):
 *   guest  → `/register`, "Create an account" — guests are view-only
 *            pre-registration, so the path to a plan starts with an account
 *            (the RadarsGuestState convention).
 *   member → `/upgrade`, "Upgrade plan" — the in-app upgrade convention
 *            (the case page's limit states).
 *
 * The card carries {@link STATUTE_PAYWALL_ID}: locked contents entries and
 * locked citation arrivals scroll HERE — there is no text to scroll to.
 */

/** The upgrade card's DOM id — the scroll target for every locked jump. */
export const STATUTE_PAYWALL_ID = 'statute-paywall';

export type PaywallViewer = 'guest' | 'member';

export function StatutePaywall({
  viewer,
  totalSections,
  includedSections,
}: {
  viewer: PaywallViewer;
  /** Full-document section count — headers first, outline fallback, or null. */
  totalSections: number | null;
  /** Sections in the excerpt, from the headers, or null. */
  includedSections: number | null;
}) {
  const counted = totalSections !== null && includedSections !== null;

  const headline =
    totalSections !== null
      ? `Read all ${totalSections} sections`
      : 'Read the full statute';

  const line =
    viewer === 'guest'
      ? counted
        ? `You've read ${includedSections} of ${totalSections} sections free — reading the rest takes an account on a paid plan.`
        : 'This free excerpt ends here — reading the rest takes an account on a paid plan.'
      : counted
        ? `You've read ${includedSections} of ${totalSections} sections free — the rest is available on a paid plan.`
        : 'This free excerpt ends here — the rest is available on a paid plan.';

  return (
    <div className="akn-paywall motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div aria-hidden className="akn-paywall-fade" />
      <section
        id={STATUTE_PAYWALL_ID}
        aria-label="Read the full statute"
        className="akn-paywall-card"
      >
        <p className="akn-paywall-kicker">
          <Lock aria-hidden className="size-3 shrink-0" />
          Free excerpt
        </p>
        <h2 className="akn-paywall-title">{headline}</h2>
        <p className="akn-paywall-copy">{line}</p>
        <p className="pt-4">
          <Link
            href={viewer === 'guest' ? '/register' : '/upgrade'}
            className={cn(
              'v2-interactive inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
              FOCUS_RING,
            )}
          >
            {viewer === 'guest' ? 'Create an account' : 'Upgrade plan'}
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </p>
      </section>
    </div>
  );
}
