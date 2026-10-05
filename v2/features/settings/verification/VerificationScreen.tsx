'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  LogIn,
  Mail,
  RotateCw,
  Scale,
  Send,
  TriangleAlert,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  LawyerDocumentType,
  LawyerProfile,
  LawyerProfileDocument,
} from '@/lib/api/lawyerVerification';
import { useExitingRows } from '@/v2/features/bookmarks/list/use-exiting-rows';
import { useV2Session } from '@/v2/runtime/session-context';
import { SETTINGS_BLOCK, SETTINGS_COLUMN } from '../SettingsList';
import { SettingsState } from '../SettingsState';
import { OtherDocumentRow, SlotRow } from './DocumentSlots';
import {
  DOCUMENT_SLOTS,
  REQUIRED_DOCUMENTS,
  arrangeDocuments,
  reviewerNote,
  stageDates,
  stageView,
  submitBlocker,
} from './model';
import {
  useRemoveVerificationDocument,
  useSubmitVerification,
  verificationQueries,
} from './queries';
import { VerificationFallback } from './states';
import { StatusPanel } from './StatusPanel';
import { useDocumentUploads } from './use-document-uploads';

/** Module-level, so the holdover's `beginExit` stays referentially stable. */
const documentKey = (document: LawyerProfileDocument): string => String(document.id);

/** One stable empty list for "no profile yet", so the arranged slots and the
 *  removal callback do not see a new array on every render. */
const NO_DOCUMENTS: readonly LawyerProfileDocument[] = [];

/**
 * VerificationScreen — v2 `/settings/verification`: a lawyer's verification,
 * from nothing sent to verified, on one screen.
 *
 * ── ONE SCREEN, SIX STAGES ─────────────────────────────────────────────────
 * The status panel at the top always says where the reader stands and what
 * to do next (`model.ts` maps every API answer to exactly one stage). Below
 * it, the documents in four named slots (Means of ID, Call to Bar
 * certificate, Practising licence, CV or résumé), placed by `document_type`;
 * files with no type are listed under Other documents. Editable while the
 * profile is a draft or a rejection that may be sent again, read-only (filled
 * slots only, no controls) while it is under review or verified. v1 split
 * this across a status card, a documents card and a timeline card; the
 * timeline's dates now sit under the status, where they answer "since when".
 *
 * ── WHY IT LIVES UNDER SETTINGS ────────────────────────────────────────────
 * It is a fact about the reader's own account that they open, act on once and
 * come back to check, which is what every other `/settings/*` screen is. v1's
 * `/lawyer-verification` address redirects here for a v2 reader.
 *
 * ── NOTHING APPEARS ABRUPTLY ───────────────────────────────────────────────
 * A slot keeps its height as it goes from empty to uploading to stored, and
 * each new state fades in where the last one was. Other documents fold in and
 * out (`use-exiting-rows`), the parts that only an editable
 * stage has collapse symmetrically when the stage stops being editable, and
 * the status panel replays its entrance when the stage changes. All of it is
 * `motion-safe`.
 */
export function VerificationScreen() {
  const { signedIn, role, isLawyer } = useV2Session();
  const hasAccount = signedIn && role !== 'guest';

  if (!signedIn) {
    return (
      <Column>
        <SettingsState
          icon={LogIn}
          title="Sign in to get verified"
          description="Verification belongs to your account, so it starts once you are signed in."
          action={
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          }
        />
      </Column>
    );
  }
  if (!hasAccount) {
    return (
      <Column>
        <SettingsState
          icon={UserPlus}
          title="A guest cannot be verified"
          description="Create an account as a lawyer, and this is where you send your documents."
          action={
            <Button asChild size="sm">
              <Link href="/register">Create account</Link>
            </Button>
          }
        />
      </Column>
    );
  }
  if (!isLawyer) {
    return (
      <Column>
        <SettingsState
          icon={Scale}
          title="Verification is for lawyers"
          description="If you practise law, set your account type to Lawyer in your profile, then come back here to send your documents."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/profile">Open profile</Link>
            </Button>
          }
        />
      </Column>
    );
  }
  return <LawyerVerification />;
}

function LawyerVerification() {
  const query = useQuery(verificationQueries.profile());

  if (query.isPending) return <VerificationFallback />;

  if (query.isError) {
    const apiError = extractApiError(query.error);
    return (
      <Column>
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="Your verification did not load"
          description={
            apiError.status >= 400 && apiError.status < 500
              ? apiError.message
              : 'Check your connection and try again.'
          }
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              <RotateCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      </Column>
    );
  }

  return (
    <VerificationBody
      profile={query.data}
      onReload={() => void query.refetch()}
      reloading={query.isFetching}
    />
  );
}

function VerificationBody({
  profile,
  onReload,
  reloading,
}: {
  profile: LawyerProfile | null;
  onReload: () => void;
  reloading: boolean;
}) {
  const view = stageView(profile);
  const documents = profile?.documents ?? NO_DOCUMENTS;
  const arranged = useMemo(() => arrangeDocuments(documents), [documents]);
  const uploads = useDocumentUploads(profile !== null);
  const remove = useRemoveVerificationDocument();
  const submit = useSubmitVerification();

  const statusHeading = useRef<HTMLHeadingElement>(null);
  /** Each empty slot's file input, so focus can land on the slot a removal
   *  just emptied. Written by ref callbacks, read in event handlers only. */
  const slotInputs = useRef<Partial<Record<LawyerDocumentType, HTMLInputElement | null>>>({});
  const [removingIds, setRemovingIds] = useState<ReadonlySet<number>>(() => new Set());

  const presentedOther = useExitingRows(arranged.other, documentKey);

  const blocker = submitBlocker(arranged, uploads.inFlight);
  const editable = view.editable;
  const busy = submit.isPending;

  const submitError = submit.error ? extractApiError(submit.error) : null;
  const submitMessage = submitError
    ? submitError.status >= 400 && submitError.status < 500
      ? submitError.message
      : 'Your documents were not sent. Check your connection and try again.'
    : null;

  const { beginExit: beginOtherExit } = presentedOther;
  const removeAsync = remove.mutateAsync;
  const resetSubmit = submit.reset;
  const handleRemove = useCallback(
    async (document: LawyerProfileDocument) => {
      const slotType = (Object.keys(arranged.slots) as LawyerDocumentType[]).find(
        (type) => arranged.slots[type]?.id === document.id,
      );
      const otherIndex = arranged.other.findIndex((d) => d.id === document.id);
      resetSubmit();
      setRemovingIds((previous) => new Set(previous).add(document.id));
      try {
        // `mutateAsync`, one promise per removal: two quick removals must each
        // settle on their own (see `use-document-uploads.ts`).
        await removeAsync(document.id);
        if (otherIndex !== -1) beginOtherExit(document, otherIndex);
        // The pressed button is gone. Focus goes to the slot it emptied, or,
        // for a file from Other documents, to the first slot still empty:
        // either way, the place a replacement comes in. A frame later, once
        // the emptied slot has rendered its input.
        window.requestAnimationFrame(() => {
          const target =
            (slotType && slotInputs.current[slotType]) ||
            DOCUMENT_SLOTS.map((slot) => slotInputs.current[slot.type]).find(Boolean);
          target?.focus();
        });
      } catch {
        // The global toast says why; the file stays where it was.
      } finally {
        setRemovingIds((previous) => {
          const next = new Set(previous);
          next.delete(document.id);
          return next;
        });
      }
    },
    [arranged, removeAsync, resetSubmit, beginOtherExit],
  );

  function handleFile(type: LawyerDocumentType, file: File) {
    submit.reset();
    uploads.add(type, file);
  }

  function handleSubmit() {
    if (blocker || busy) return;
    submit.mutate(undefined, {
      onSuccess: () => {
        toast.success('Sent for review');
        // A frame later: the panel is keyed by stage, so the heading that
        // takes focus is the NEW one, mounted by the render this answer
        // causes. Focusing now would land on the one about to unmount.
        window.requestAnimationFrame(() => statusHeading.current?.focus());
      },
    });
  }

  const note = reviewerNote(profile);
  const statusAction =
    view.stage === 'unknown' ? (
      <Button size="sm" variant="outline" onClick={onReload} disabled={reloading}>
        <RotateCw aria-hidden className={cn('size-4', reloading && 'animate-spin')} />
        Try again
      </Button>
    ) : view.stage === 'rejected' && !editable ? (
      <Button asChild size="sm" variant="outline">
        <a href="mailto:support@lawexa.com">
          <Mail aria-hidden className="size-4" />
          Email support
        </a>
      </Button>
    ) : undefined;

  // Editable: all four slots, empty ones included, because each is where its
  // file goes. Read-only: only the filled ones, since an empty slot with no
  // way to fill it says nothing.
  const shownSlots = editable
    ? DOCUMENT_SLOTS
    : DOCUMENT_SLOTS.filter((slot) => arranged.slots[slot.type] !== null);
  const hasOther = presentedOther.presented.length > 0;
  const hintId = 'verification-submit-hint';
  const errorId = 'verification-submit-error';

  return (
    <Column>
      <StatusPanel
        key={view.stage}
        view={view}
        dates={stageDates(profile)}
        note={note}
        action={statusAction}
        headingRef={statusHeading}
      />

      <section aria-labelledby="verification-documents" className="mt-5">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <h2 id="verification-documents" className="text-[13px] leading-snug font-medium text-muted-foreground">
            Your documents
          </h2>
          {editable ? (
            <span className="text-[13px] leading-snug tabular-nums text-muted-foreground">
              {`${documents.length} of ${REQUIRED_DOCUMENTS}`}
            </span>
          ) : null}
        </div>
        {editable ? (
          <>
            <p className="px-1 pt-1 text-[13px] leading-snug text-muted-foreground/80">
              One file for each, as a PDF, JPG or PNG of up to 10 MB. Choose it, or drop it on its row.
            </p>
            <CountMeter count={documents.length} />
          </>
        ) : null}

        {shownSlots.length > 0 ? (
          <ul className={cn(SETTINGS_BLOCK, 'mt-2')}>
            {shownSlots.map((slot) => {
              const document = arranged.slots[slot.type];
              return (
                <SlotRow
                  key={slot.type}
                  slot={slot}
                  document={document}
                  upload={uploads.bySlot[slot.type]}
                  editable={editable}
                  locked={busy}
                  removing={document !== null && removingIds.has(document.id)}
                  inputRef={(element) => {
                    slotInputs.current[slot.type] = element;
                  }}
                  onFile={handleFile}
                  onRemove={(target) => void handleRemove(target)}
                  onCancel={uploads.cancel}
                  onRetry={uploads.retry}
                  onDismiss={uploads.dismiss}
                />
              );
            })}
          </ul>
        ) : !hasOther ? (
          <p className="mt-2 rounded-2xl bg-secondary px-4 py-4 text-[15px] leading-snug text-muted-foreground">
            No documents on this profile.
          </p>
        ) : null}
      </section>

      <Reveal open={hasOther}>
        <section aria-labelledby="verification-other">
          <h2 id="verification-other" className="px-1 text-[13px] leading-snug font-medium text-muted-foreground">
            Other documents
          </h2>
          <p className="px-1 pt-1 text-[13px] leading-snug text-muted-foreground/80">
            {editable
              ? 'Sent before documents had a name, so they sit in no slot. They still count toward the four. To name one, remove it and upload it into its slot.'
              : 'Sent before documents had a name, so they sit in no slot.'}
          </p>
          <ul className={cn(SETTINGS_BLOCK, 'mt-2')}>
            {presentedOther.presented.map((presented) => (
              <OtherDocumentRow
                key={presented.row.id}
                presented={presented}
                editable={editable}
                locked={busy}
                removing={removingIds.has(presented.row.id)}
                onRemove={(target) => void handleRemove(target)}
              />
            ))}
          </ul>
        </section>
      </Reveal>

      <Reveal open={editable && view.submitLabel !== null}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {submitMessage ? (
              <p
                id={errorId}
                role="alert"
                className="text-[13px] leading-snug text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                {submitMessage}
              </p>
            ) : (
              <p id={hintId} className="text-[13px] leading-snug text-muted-foreground">
                {blocker ?? 'Once sent, your documents are locked until a reviewer has decided.'}
              </p>
            )}
          </div>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={blocker !== null || busy}
            aria-busy={busy || undefined}
            aria-describedby={submitMessage ? errorId : hintId}
            className="w-full shrink-0 sm:w-auto"
          >
            {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
            {view.submitLabel ?? 'Send for review'}
          </Button>
        </div>
      </Reveal>
    </Column>
  );
}

function Column({ children }: { children: React.ReactNode }) {
  return (
    <div className={SETTINGS_COLUMN}>
      {/* One title per screen: the bar carries it below `md:`, the page from
          `md:` up (see `SettingsList`). */}
      <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
        Lawyer verification
      </h1>
      {children}
    </div>
  );
}

/**
 * A part of the screen that only some stages have, collapsing and opening on
 * the same curve in both directions (the grid-rows idiom `UploadTray` uses).
 * Closed, it is `inert` and `aria-hidden` and takes no height, so nothing
 * focusable or announceable sits invisibly in the page.
 *
 * The spacing above the content lives INSIDE the clip, so a closed part leaves
 * no gap behind. The inner padding and the matching negative margin give a
 * focus ring room to draw without being clipped by the fold.
 */
function Reveal({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!open}
      inert={!open}
      className={cn(
        '-mx-1 grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="px-1 pt-5 pb-1">{children}</div>
      </div>
    </div>
  );
}

/**
 * Four segments under "Your documents", one per required file, filled as
 * documents are stored. Decorative: the "2 of 4" beside the heading is the
 * text a screen reader gets.
 */
function CountMeter({ count }: { count: number }) {
  return (
    <div aria-hidden className="mt-2 grid grid-cols-4 gap-1.5 px-1">
      {Array.from({ length: REQUIRED_DOCUMENTS }, (_, index) => (
        <span
          key={index}
          className={cn(
            'h-1 rounded-full transition-colors duration-300 motion-reduce:transition-none',
            index < count ? 'bg-primary' : 'bg-foreground/10',
          )}
        />
      ))}
    </div>
  );
}
