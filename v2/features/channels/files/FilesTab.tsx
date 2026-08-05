'use client';

import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { useAuthStore } from '@/lib/stores/authStore';
import type { Channel } from '@/types/collab';
import { TabRow } from '@/v2/shell/TabRow';
import { FILE_ACCEPT_ATTR } from '../model';
import { channelsQueries } from '../queries';
import { groupByRecency } from '../recency';
import { fileKind, fileLenses, resolveFileLens, type FileLens } from './file-model';
import { FileRow } from './FileRow';
import {
  FilesEmptyState,
  FilesErrorState,
  FilesNoMatchState,
  FilesSkeleton,
} from './states';
import { UploadTray } from './UploadTray';
import { useUploadQueue } from './use-upload-queue';

/**
 * FilesTab — the channel's document library, rebuilt at CHAT'S DENSITY.
 *
 * ── WHAT CHANGED, AND WHY ──────────────────────────────────────────────────
 * This was the only surface in the feature built from bordered cards, living
 * in the same screen as the hairline-row transcript — two densities in one
 * screen. It is now hairline rows led by a 40px `FileMark` (a real thumbnail
 * for images), grouped under Today / This week / Earlier, with a type filter
 * that appears only once the library is big enough to need one, and a docked
 * upload tray carrying determinate progress, cancel, and the rejections that
 * used to stack up in an unbounded red strip.
 *
 * ── WHAT DID NOT CHANGE, DELIBERATELY ──────────────────────────────────────
 * The drag-depth counter and the `types.includes('Files')` guard (without them
 * a drag across a child element flickers the overlay, and dragging TEXT over
 * the panel arms a file drop that cannot happen); client pre-validation with
 * inline rejection and never a toast; zip download-only with its caution
 * intact; uploader-or-admin delete behind a confirm that stays out of the URL.
 *
 * ── PREVIEW MODE NEVER GETS HERE ───────────────────────────────────────────
 * The file list is on the blocked-read list for a space member previewing a
 * public channel, and the enforcement is a MOUNT gate in `ChannelScreen`
 * (`sectionAvailable.files = canParticipate`), not a check in here: a blocked
 * read must never be REQUESTED, and this component's query fires the moment it
 * exists. Nothing in this file may be mounted from anywhere else.
 *
 * ── THE TYPE LENS IS LOCAL, NOT URL, STATE ─────────────────────────────────
 * `/channels/[channelId]` is a DYNAMIC route, where a loud URL write restarts
 * the `/undefined` refetch loop documented in `v2/runtime/url-params.ts`, and
 * the quiet writer is invisible to `useSearchParams`. A transient lens inside
 * a tab does not earn a third URL param and its own popstate adopter; the
 * selections that DO live in the URL here (`?tab=`, `?list=`) each earned it
 * by being a place you can link someone to.
 *
 * Phase-5 W2; rebuilt for the redesign wave, 2026-08-05. Sources: LF §4 via
 * api-digest §C/§F.10.
 */
const PANEL_ID = 'channel-files-panel';

export function FilesTab({
  channel,
  viewerId,
}: {
  channel: Channel;
  viewerId: number | null;
}) {
  const filesQuery = useQuery(
    channelsQueries.files({ channelUuid: channel.uuid, viewerId }),
  );
  const queue = useUploadQueue(channel.uuid);
  // Files are the uuid-only rule's exception (§F.4): the uploader check needs
  // the INTEGER id, which only the sanctioned bridge carries.
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);
  const [lens, setLens] = useState<FileLens>('all');
  // Frozen at mount, like every other date grouping: one clock for the whole
  // paint, and no `Date.now()` in render (React Compiler lint).
  const [now] = useState(() => Date.now());

  const files = useMemo(() => filesQuery.data?.data ?? [], [filesQuery.data]);
  const lenses = useMemo(() => fileLenses(files), [files]);
  // A selected kind can stop existing under the reader (the last image is
  // deleted); resolving in render keeps that a derivation, never a state loop.
  const activeLens = resolveFileLens(lens, lenses);

  const visible = useMemo(
    () =>
      activeLens === 'all'
        ? files
        : files.filter((file) => fileKind(file) === activeLens),
    [files, activeLens],
  );
  const sections = useMemo(
    () => groupByRecency(visible, now, (file) => file.created_at),
    [visible, now],
  );

  const openFilePicker = () => inputRef.current?.click();

  /* ── Drag and drop ───────────────────────────────────────────────────────
     The DEPTH COUNTER is what makes the overlay stable: `dragleave` fires
     every time the pointer crosses into a CHILD element, so a naive
     leave-hides-it would strobe the whole way across the panel. The
     `types.includes('Files')` guard is the other half — dragging selected
     text over the panel must not arm a drop that can never produce a file. */
  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    queue.add(event.dataTransfer.files);
  };

  const apiError = filesQuery.error ? extractApiError(filesQuery.error) : null;
  const showSkeleton = filesQuery.isPending;
  const showError = filesQuery.isError && files.length === 0;
  const showEmpty = !showSkeleton && !showError && files.length === 0;
  const showNoMatch =
    !showSkeleton && !showError && !showEmpty && visible.length === 0;

  return (
    // Scroll lives on the inner wrapper so the drop overlay always covers the
    // VISIBLE panel box even when the list is scrolled.
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_ACCEPT_ATTR}
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            queue.add(event.target.files);
          }
          event.target.value = '';
        }}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between gap-3 pb-3">
            <h2 className="text-base font-semibold">
              Files
              {files.length > 0 ? (
                <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">
                  {files.length}
                </span>
              ) : null}
            </h2>
            <Button size="sm" onClick={openFilePicker}>
              <Upload aria-hidden className="size-4" />
              Upload
            </Button>
          </div>

          {/* The type strip GROWS rather than snaps. It exists only for a
              library big enough to need it, so a skeleton cannot honestly
              reserve its height — and a strip that appears the instant data
              lands would shove the first row down in one frame. Always
              mounted, tweening `grid-rows-[0fr]` ↔ `[1fr]`: the same symmetric
              collapse `EnablePushNudge` and the channel's own section strip
              use, `inert` + `aria-hidden` at zero height so nothing focusable
              sits invisibly above the list. */}
          <div
            aria-hidden={lenses.length === 0}
            inert={lenses.length === 0}
            className={cn(
              'grid transition-[grid-template-rows] duration-200 ease-out',
              'motion-reduce:transition-none',
              lenses.length > 0 ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div className="pb-3">
                <TabRow
                  tabs={lenses}
                  value={activeLens}
                  onChange={setLens}
                  ariaLabel="Filter files by type"
                  panelId={PANEL_ID}
                  className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-secondary/60 p-0.5"
                  tabClassName={(selected) =>
                    cn(
                      'v2-interactive min-h-8 shrink-0 rounded-full px-3.5 text-xs font-medium transition-colors duration-150 motion-reduce:transition-none',
                      selected
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )
                  }
                >
                  {(tab) => tab.label}
                </TabRow>
              </div>
            </div>
          </div>

          {/* The strip's panel. `aria-labelledby` names the SELECTED tab, which
              is the other half of the contract `TabRow`'s `panelId` opens: a
              tablist with no panel is a promise with nothing behind it. Both
              attributes are dropped when the strip is not offered, so the
              region never claims to be a tab panel for a tablist that is not
              there. */}
          <div
            id={PANEL_ID}
            role={lenses.length > 0 ? 'tabpanel' : undefined}
            aria-labelledby={
              lenses.length > 0 ? `${PANEL_ID}-tab-${activeLens}` : undefined
            }
          >
            {showSkeleton ? (
              <FilesSkeleton />
            ) : showError ? (
              <FilesErrorState
                message={apiError?.message}
                onRetry={() => void filesQuery.refetch()}
              />
            ) : showEmpty ? (
              <FilesEmptyState dragging={isDragging} onUpload={openFilePicker} />
            ) : showNoMatch ? (
              <FilesNoMatchState onReset={() => setLens('all')} />
            ) : (
              <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                {sections.map((section) => (
                  <section key={section.bucket}>
                    <h3 className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      {section.label}
                    </h3>
                    <div className="flex flex-col divide-y divide-border/60">
                      {section.rows.map((file) => (
                        <FileRow
                          key={file.id}
                          file={file}
                          channel={channel}
                          currentUserId={currentUserId}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* The docked tray — always mounted, zero height when there is nothing
          in flight (the `EnablePushNudge` collapse idiom). */}
      <UploadTray queue={queue} />

      {/* Drop overlay — symmetric fade, pointer-transparent, above the tray. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-xs',
          'transition-opacity duration-200 motion-reduce:transition-none',
          isDragging ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/60 bg-card px-8 py-6 text-center shadow-sm">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/10">
            <Upload aria-hidden className="size-5 text-primary" />
          </div>
          <p className="text-sm font-medium">Drop files to upload</p>
        </div>
      </div>
    </div>
  );
}
