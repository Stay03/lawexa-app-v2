'use client';

import { Folder, Globe } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * folder-bits — the two pieces of furniture a folder wears wherever it appears,
 * kept in one module so a row and a page header cannot describe the same folder
 * with two different glyphs or two different words.
 */

/**
 * The folder glyph, on a tile.
 *
 * ONE MONOCHROME GLYPH (decision 2). v1 offered twelve icons and ten colour
 * swatches; every legal-research incumbent is monochrome, and Zotero — the
 * closest folder-mature product to this one — gives collections no colour at
 * all. What survives is the LEGACY tint: a folder that already carries a colour
 * keeps it, because the person who colour-coded their shelf should not find it
 * repainted. v2 mints none.
 */
export function FolderTile({
  tint,
  size = 'row',
  className,
}: {
  /** A validated 6-digit hex from `folderRow`, or `null`. */
  tint: string | null;
  size?: 'row' | 'header';
  className?: string;
}) {
  const header = size === 'header';
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center transition-colors',
        header ? 'size-11 rounded-xl' : 'mt-0.5 size-9 rounded-lg',
        tint ? undefined : 'bg-secondary text-muted-foreground',
        className,
      )}
      // The folder's own colour at tint strength — the `BookmarkRow` treatment,
      // and the same 8-digit-safe hex `folderTint` guarantees.
      style={tint ? { backgroundColor: `${tint}1f`, color: tint } : undefined}
    >
      <Folder className={header ? 'size-5' : 'size-[18px]'} />
    </span>
  );
}

/**
 * The PUBLIC mark — and it marks the exception, not the rule.
 *
 * v2 creates every folder private and offers no toggle (decision 3), so
 * "Private" is the unremarkable default and a lock on every row would be noise.
 * A folder created in v1, where public was the DEFAULT, can still be listed
 * where strangers can find it — that is the state worth a word, and the amber
 * treatment the notes list gives a draft: a mark and a word, never colour alone.
 */
export function FolderPublicMark() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-amber-700 dark:text-amber-400">
      <Globe aria-hidden className="size-3" />
      Public
    </span>
  );
}
