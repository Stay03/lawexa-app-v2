'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CheckCircle2, Hourglass } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { IBlockedReason } from '@/types/message-pack';
import type { CreateRadarPayload, Radar } from '@/types/radar';
import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import {
  RadarsGuestState,
  RadarsSignedOutState,
} from '../list/states';
import { RadarForm, type RadarFormHelpers } from './RadarForm';
import { useCreateRadar } from './use-create-radar';

/**
 * CreateRadarScreen — the `/radars/new` client root.
 *
 * ── THE THREE OUTCOMES OF A CREATE ──────────────────────────────────────────
 *  1. Created + first scan dispatched → toast, navigate to the radar (where
 *     the naming shimmer and the first-scan placeholder take over).
 *  2. Created + first scan BLOCKED (no message balance) → the IN-PAGE blocked
 *     state below: the radar exists and will scan on schedule, so this is a
 *     success with a caveat, never a dead end (study rule — v1 swapped the
 *     whole page for a banner). It says what happened, when the balance
 *     resets, and offers both paths on: the radar itself and more messages.
 *  3. Rejected (422 / moderation) → errors land on their FIELDS via the
 *     form's mapping; a message that matched no field renders as the form's
 *     in-page banner. No toast in either case (`silentError` on the
 *     mutation) — the study's honest-error rule.
 */
export function CreateRadarScreen() {
  const { signedIn, role } = useV2Session();
  const router = useRouter();
  const createRadar = useCreateRadar();
  const [blocked, setBlocked] = useState<{
    radar: Radar;
    reason: IBlockedReason;
  } | null>(null);

  /**
   * NOTHING IS PUBLISHED TO THE HEADER FROM HERE ANY MORE (phase 7). "New
   * radar" is a fact about the ADDRESS, so `v2/shell/pushed-route.ts` states it
   * once and the bar has it on the first frame, in every state including the
   * two refusals below. The "Back to radars" chip that opened the page has gone
   * with it: the bar carries the way back.
   */

  const handleSubmit = (
    payload: CreateRadarPayload,
    helpers: RadarFormHelpers,
  ) => {
    createRadar.mutate(payload, {
      onSuccess: (response) => {
        const { radar, first_scan } = response.data;
        if (first_scan.block_reason) {
          setBlocked({ radar, reason: first_scan.block_reason });
          return;
        }
        toast.success('Radar created', {
          description: first_scan.dispatched
            ? 'The first scan is running — its report lands shortly.'
            : 'The first report arrives on schedule.',
        });
        router.push(`/radars/${radar.uuid}`);
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        if (apiError.errors && helpers.applyServerErrors(apiError.errors)) {
          return;
        }
        helpers.setFormError(apiError.message);
      },
    });
  };

  if (!signedIn) {
    return (
      <div className={LIST_COLUMN}>
        <RadarsSignedOutState />
      </div>
    );
  }
  if (role === 'guest') {
    return (
      <div className={LIST_COLUMN}>
        <RadarsGuestState />
      </div>
    );
  }

  return (
    <div className={LIST_COLUMN}>
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
        {/* ONE TITLE PER SCREEN, AT EVERY WIDTH (phase 7): the shell's bar says
            "New radar" below `md:`, so the heading is stated for assistive tech
            and drawn only from `md:` up, where the bar's title is hidden. The
            sentence under it stays at every width — it is the instruction, not
            a second title. */}
        <header className="mb-6 space-y-1 md:mt-4">
          <h1 className="sr-only md:not-sr-only md:text-xl md:font-semibold md:tracking-tight md:text-foreground">
            New radar
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            Choose what to watch. Lawexa scans on your schedule and files a
            sourced report when something moves.
          </p>
        </header>

        {blocked ? (
          <BlockedFirstScanState radar={blocked.radar} reason={blocked.reason} />
        ) : (
          <RadarForm
            mode="create"
            isSubmitting={createRadar.isPending}
            submitLabel="Create radar"
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

/** Outcome 2: created, but the immediate first scan was blocked for balance. */
function BlockedFirstScanState({
  radar,
  reason,
}: {
  radar: Radar;
  reason: IBlockedReason;
}) {
  const resets = formatResetDate(reason.resets_at);

  return (
    <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              &ldquo;{radar.name}&rdquo; was created
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              It will scan on schedule once you have message balance — only the
              immediate first scan was skipped.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-5">
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
        >
          <Hourglass className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">
            First scan skipped — no message balance
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {reason.message}
            {resets ? ` Your plan messages reset ${resets}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href={`/radars/${radar.uuid}`}>Go to radar</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/message-packs">
              Get more messages
              <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatResetDate(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
}
