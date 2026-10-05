'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  FileBadge,
  FileUser,
  IdCard,
  Loader2,
  LogIn,
  Mail,
  RotateCw,
  Scale,
  Send,
  TriangleAlert,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { LawyerProfile, LawyerProfileDocument } from '@/lib/api/lawyerVerification';
import { useExitingRows } from '@/v2/features/bookmarks/list/use-exiting-rows';
import { useV2Session } from '@/v2/runtime/session-context';
import { SETTINGS_COLUMN } from '../SettingsList';
import { SettingsFormGroup } from '../SettingsForm';
import { SettingsState } from '../SettingsState';
import { DocumentList, DropZone } from './DocumentList';
import {
  DOCUMENTS_TO_SEND,
  REQUIRED_DOCUMENTS,
  placesLeft as countPlacesLeft,
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
import { useDocumentUploads, type UploadEntry } from './use-document-uploads';

const SEND_ICON: Record<(typeof DOCUMENTS_TO_SEND)[number]['id'], LucideIcon> = {
  identity: IdCard,
  call: Award,
  licence: FileBadge,
  cv: FileUser,
};

/** Module-level, so the holdovers' `beginExit` stays referentially stable. */
const documentKey = (document: LawyerProfileDocument): string => String(document.id);
const uploadKey = (entry: UploadEntry): string => String(entry.id);

/** One stable empty list for "no profile yet", so the row holdover and the
 *  removal callback do not see a new array on every render. */
const NO_DOCUMENTS: readonly LawyerProfileDocument[] = [];

/**
 * VerificationScreen — v2 `/settings/verification`: a lawyer's verification,
 * from nothing sent to verified, on one screen.
 *
 * ── ONE SCREEN, SIX STAGES ─────────────────────────────────────────────────
 * The status panel at the top always says where the reader stands and what
 * to do next (`model.ts` maps every API answer to exactly one stage). Below
 * it, the documents: editable while the profile is a draft or a rejection that
 * may be sent again, read-only while it is under review or verified. v1 split
 * this across a status card, a documents card and a timeline card; the
 * timeline's dates now sit under the status, where they answer "since when".
 *
 * ── WHY IT LIVES UNDER SETTINGS ────────────────────────────────────────────
 * It is a fact about the reader's own account that they open, act on once and
 * come back to check, which is what every other `/settings/*` screen is. v1's
 * `/lawyer-verification` address redirects here for a v2 reader.
 *
 * ── NOTHING APPEARS ABRUPTLY ───────────────────────────────────────────────
 * Rows fold in and out (`use-exiting-rows`), the parts that only an editable
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
  const uploads = useDocumentUploads(profile !== null);
  const remove = useRemoveVerificationDocument();
  const submit = useSubmitVerification();

  const statusHeading = useRef<HTMLHeadingElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [removingIds, setRemovingIds] = useState<ReadonlySet<number>>(() => new Set());

  const presentedDocuments = useExitingRows(documents, documentKey);
  const presentedUploads = useExitingRows(uploads.entries, uploadKey);

  const placesLeft = countPlacesLeft(documents.length, uploads.inFlight);
  const blocker = submitBlocker(documents.length, uploads.inFlight);
  const editable = view.editable;
  const busy = submit.isPending;

  const submitError = submit.error ? extractApiError(submit.error) : null;
  const submitMessage = submitError
    ? submitError.status >= 400 && submitError.status < 500
      ? submitError.message
      : 'Your documents were not sent. Check your connection and try again.'
    : null;

  const { beginExit: beginDocumentExit } = presentedDocuments;
  const removeAsync = remove.mutateAsync;
  const resetSubmit = submit.reset;
  const handleRemove = useCallback(
    async (document: LawyerProfileDocument) => {
      const index = documents.findIndex((d) => d.id === document.id);
      resetSubmit();
      setRemovingIds((previous) => new Set(previous).add(document.id));
      try {
        // `mutateAsync`, one promise per removal: two quick removals must each
        // get their own exit (see `use-document-uploads.ts`).
        await removeAsync(document.id);
        beginDocumentExit(document, Math.max(0, index));
        // The pressed button is leaving with its row. Focus goes to the way
        // a replacement comes in, which is what the reader removed it for.
        // A frame later, once the upload zone has re-opened and lost `inert`.
        window.requestAnimationFrame(() => fileInput.current?.focus());
      } catch {
        // The global toast says why; the row stays where it was.
      } finally {
        setRemovingIds((previous) => {
          const next = new Set(previous);
          next.delete(document.id);
          return next;
        });
      }
    },
    [documents, removeAsync, resetSubmit, beginDocumentExit],
  );

  const { beginExit: beginUploadExit } = presentedUploads;
  const leaveUpload = useCallback(
    (entry: UploadEntry, then: (id: number) => void) => {
      const index = uploads.entries.findIndex((e) => e.id === entry.id);
      beginUploadExit(entry, Math.max(0, index));
      then(entry.id);
    },
    [uploads.entries, beginUploadExit],
  );

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

  const hasRows = presentedDocuments.presented.length > 0 || presentedUploads.presented.length > 0;
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

      <Reveal open={editable}>
        <SettingsFormGroup
          id="verification-what"
          label="What to send"
          description="One file for each, as a PDF, JPG or PNG of up to 10 MB."
        >
          {DOCUMENTS_TO_SEND.map((item) => {
            const Icon = SEND_ICON[item.id];
            return (
              <li key={item.id} className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
                <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] leading-snug font-medium text-foreground">{item.label}</span>
                  <span className="text-[13px] leading-snug text-muted-foreground">{item.detail}</span>
                </span>
              </li>
            );
          })}
        </SettingsFormGroup>
      </Reveal>

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
        {editable ? <CountMeter count={documents.length} /> : null}

        {hasRows ? (
          <div className="mt-2">
            <DocumentList
              documents={presentedDocuments.presented}
              uploads={presentedUploads.presented}
              editable={editable}
              locked={busy}
              removingIds={removingIds}
              placesLeft={placesLeft}
              onRemove={(document) => void handleRemove(document)}
              onCancel={(entry) => leaveUpload(entry, uploads.cancel)}
              onRetry={(entry) => uploads.retry(entry.id)}
              onDismiss={(entry) => leaveUpload(entry, uploads.dismiss)}
            />
          </div>
        ) : !editable ? (
          <p className="mt-2 rounded-2xl bg-secondary px-4 py-4 text-[15px] leading-snug text-muted-foreground">
            No documents on this profile.
          </p>
        ) : null}

        <Reveal open={editable && placesLeft > 0}>
          <DropZone
            placesLeft={placesLeft}
            disabled={!editable || busy || placesLeft === 0}
            onFiles={(files) => {
              submit.reset();
              uploads.add(files, placesLeft);
            }}
            inputRef={fileInput}
          />
        </Reveal>
      </section>

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
            ) : blocker ? (
              <p id={hintId} className="text-[13px] leading-snug text-muted-foreground">
                {blocker}
              </p>
            ) : (
              <p id={hintId} className="text-[13px] leading-snug text-muted-foreground">
                Once sent, your documents are locked until a reviewer has decided.
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
