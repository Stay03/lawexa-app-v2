'use client';

import { Check, ChevronRight, Folder, FolderPlus, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import type { FolderRecord } from '../types';
import { folderAncestorAddress, folderContentsLine } from './picker-model';

/**
 * PickerRows.tsx — one destination row, in the house two-zone grammar
 * ([ monochrome folder tile ] → [ name / what is inside ] → [ trailing state ]),
 * wearing whichever interaction model its surface can actually be driven with.
 *
 * ── TWO MODELS, ONE ROW ────────────────────────────────────────────────────
 * DIALOG (pointer + keyboard). The rows are `role="option"` under a listbox
 * driven by `aria-activedescendant`, and an option may own no interactive
 * descendants. A folder with subfolders therefore gets a chevron ZONE, not a
 * button: the row's single click handler hit-tests it, and the same action sits
 * on Right Arrow, which every drillable option announces.
 *
 * SHEET (touch). That model breaks down on a phone, and breaks exactly where v1
 * broke: there is no Right Arrow, the chevron is `aria-hidden`, so the only
 * route into a subfolder disappears and a double-tap files the item into the
 * PARENT — "subfolders unreachable, silently", reintroduced for one population.
 * A listbox buys nothing without a keyboard, so the sheet drops it: a plain
 * list, a real `<button>` for the destination and a second, separately named
 * `<button>` ("Open Contract law") for the way in, at a 44px touch target.
 *
 * NO COLOUR, NO ICON PICKER (owner decision 2): one monochrome glyph. A legacy
 * folder's stored `color` tints its tile and nothing else, so v1's palette
 * still reads without v2 minting a single new swatch.
 */

/** The `data-` flag the DIALOG row's click handler hit-tests to tell drill from choose. */
const DRILL_ATTRIBUTE = 'data-picker-drill';

/** Everything a row shows, whichever model it is wearing. */
export interface FolderRowView {
  folder: FolderRecord;
  /** A write for THIS folder is on the wire. */
  busy: boolean;
  /** The server has told us this folder already holds the item (a 422). */
  alreadyHolds: boolean;
  /** Show the ancestor address — root searches only, where rows leave their level. */
  showAddress: boolean;
}

/** The row's innards. Presentational: no handlers, no roles, no focus. */
function FolderRowContent({ folder, busy, alreadyHolds, showAddress }: FolderRowView) {
  const address = showAddress ? folderAncestorAddress(folder.slug_path) : null;

  return (
    <>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
        // Legacy tint only — v2 mints no colours. Gated on a real string so an
        // absent/`null` colour never becomes an inline style.
        style={folder.color ? { color: folder.color } : undefined}
      >
        <Folder className="size-[18px]" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {folder.name}
          </span>
          {/* v2 creates every folder private, so the mark worth making is the
              LEGACY exception: a folder that is publicly listed. Gated on
              proof (`=== false`), never on an absent field falling through. */}
          {folder.is_private === false ? (
            <span className="shrink-0 rounded-full bg-secondary px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Public
            </span>
          ) : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {alreadyHolds ? 'Already in this folder' : folderContentsLine(folder)}
        </span>
        {address ? (
          <span className="truncate text-[11px] text-muted-foreground/70">
            {address}
          </span>
        ) : null}
      </span>

      {busy ? (
        <Loader2
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground motion-safe:animate-spin motion-reduce:opacity-60"
        />
      ) : alreadyHolds ? (
        <Check aria-hidden className="size-4 shrink-0 text-primary" />
      ) : null}
    </>
  );
}

/** The row box, shared so the two models cannot drift apart visually. */
const ROW_BOX = 'flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors';

/* ── Dialog: one listbox option ──────────────────────────────────────────── */

export function FolderOption({
  view,
  optionId,
  active,
  onChoose,
  onDrill,
  onHover,
}: {
  view: FolderRowView;
  optionId: string;
  active: boolean;
  onChoose: () => void;
  onDrill: () => void;
  onHover: () => void;
}) {
  const canDrill = view.folder.children_count > 0;

  const press = (event: React.MouseEvent<HTMLLIElement>) => {
    const target = event.target;
    const drill =
      target instanceof Element && target.closest(`[${DRILL_ATTRIBUTE}]`) !== null;
    if (drill && canDrill) {
      onDrill();
      return;
    }
    onChoose();
  };

  return (
    <li
      id={optionId}
      role="option"
      aria-selected={active}
      onClick={press}
      onMouseMove={onHover}
      className={cn(
        'v2-interactive cursor-pointer',
        ROW_BOX,
        active && 'bg-secondary',
        view.alreadyHolds && 'opacity-70',
      )}
    >
      <FolderRowContent {...view} />
      {canDrill ? (
        <>
          <span
            {...{ [DRILL_ATTRIBUTE]: '' }}
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </span>
          {/* Named for the reader who cannot see the chevron. Right Arrow is
              the real, focus-reachable command; the chevron only mirrors it. */}
          <span className="sr-only"> — press Right Arrow to open this folder</span>
        </>
      ) : null}
    </li>
  );
}

/* ── Sheet: two real buttons ─────────────────────────────────────────────── */

export function FolderRow({
  view,
  onChoose,
  onDrill,
}: {
  view: FolderRowView;
  onChoose: () => void;
  onDrill: () => void;
}) {
  const canDrill = view.folder.children_count > 0;

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        onClick={onChoose}
        className={cn(
          'v2-interactive min-w-0 flex-1 text-left hover:bg-secondary',
          ROW_BOX,
          view.alreadyHolds && 'opacity-70',
          FOCUS_RING,
        )}
      >
        <FolderRowContent {...view} />
      </button>
      {canDrill ? (
        <button
          type="button"
          onClick={onDrill}
          aria-label={`Open ${view.folder.name}`}
          className={cn(
            'v2-interactive flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      ) : null}
    </li>
  );
}

/* ── The last row, always: create ────────────────────────────────────────── */

export interface CreateRowView {
  /** The trimmed name typed into the field, or `''` when nothing is typed. */
  name: string;
  /** Where it would land — "New private folder in Contract law". */
  destination: string;
  busy: boolean;
}

function CreateRowContent({ name, destination, busy }: CreateRowView) {
  return (
    <>
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground"
      >
        {busy ? (
          <Loader2 className="size-[18px] motion-safe:animate-spin motion-reduce:opacity-60" />
        ) : (
          <FolderPlus className="size-[18px]" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {name ? `Create “${name}”` : 'New folder'}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {name ? destination : 'Type a name above to create one'}
        </span>
      </span>
    </>
  );
}

/**
 * IT NEVER AUTO-HIGHLIGHTS OVER A REAL MATCH: the highlight resolves to the
 * FIRST option and this row is last, so it is only ever pre-selected when the
 * list holds nothing else to choose. And it never fires on blur — the only
 * activations are a click and Enter.
 */
export function CreateOption({
  view,
  optionId,
  active,
  onActivate,
  onHover,
}: {
  view: CreateRowView;
  optionId: string;
  active: boolean;
  onActivate: () => void;
  onHover: () => void;
}) {
  return (
    <li
      id={optionId}
      role="option"
      aria-selected={active}
      onClick={onActivate}
      onMouseMove={onHover}
      className={cn('v2-interactive cursor-pointer', ROW_BOX, active && 'bg-secondary')}
    >
      <CreateRowContent {...view} />
    </li>
  );
}

export function CreateRow({
  view,
  onActivate,
}: {
  view: CreateRowView;
  onActivate: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onActivate}
        className={cn(
          'v2-interactive w-full text-left hover:bg-secondary',
          ROW_BOX,
          FOCUS_RING,
        )}
      >
        <CreateRowContent {...view} />
      </button>
    </li>
  );
}

/* ── States ──────────────────────────────────────────────────────────────── */

/** The list's resting shape while the first level resolves — exact geometry. */
export function PickerRowsSkeleton() {
  return (
    <ul aria-hidden className="flex flex-col gap-0.5">
      {[0, 1, 2, 3].map((row) => (
        <li key={row} className="flex items-center gap-3 px-2.5 py-2">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40 max-w-[70%]" />
            <Skeleton className="h-3 w-24" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A dead end that still offers the way out. */
export function PickerNotice({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-start gap-2 px-2.5 py-6">
      <p className="text-sm text-foreground">{title}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className={cn(
            'v2-interactive inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            FOCUS_RING,
          )}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
