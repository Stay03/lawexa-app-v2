'use client';

import Link from 'next/link';
import { FileText, Landmark, NotebookPen, Radar, Scale, type LucideIcon } from 'lucide-react';
import { getCaseDisplayTitle } from '@/lib/utils/case-title';
import type { ConversationReference } from '@/types/chat';

/**
 * ReferenceChips — the "About:" row (§C KEEP): the content a conversation is about
 * (case / statute / note / radar / radar_scan), as real titled links. Ported from
 * v1's `buildReferenceChips`; deleted content (null) is dropped, radar_scan links
 * through its sibling radar reference.
 *
 * NOTE: v1 pairs this row with an `AddToFolderButton` (from `components/folders`,
 * boundary-blocked). The folders feature is a separate v2 port, so that action is
 * deferred here; the reference chips themselves are the substantive KEEP.
 */
type RefChip = { key: string; label: string; href: string | null; Icon: LucideIcon };

function buildReferenceChips(references: ConversationReference[]): RefChip[] {
  return references
    .map((ref): RefChip | null => {
      switch (ref.type) {
        case 'case': {
          const c = ref.content;
          return c
            ? { key: `case-${c.id}`, label: getCaseDisplayTitle(c), href: `/cases/${c.slug}`, Icon: Scale }
            : null;
        }
        case 'statute': {
          const c = ref.content;
          return c
            ? { key: `statute-${c.id}`, label: c.short_title ?? c.title, href: `/statutes/${c.slug}`, Icon: Landmark }
            : null;
        }
        case 'note': {
          const c = ref.content;
          return c
            ? { key: `note-${c.id}`, label: c.title, href: `/notes/${c.slug}`, Icon: NotebookPen }
            : null;
        }
        case 'radar': {
          const c = ref.content;
          return c ? { key: `radar-${c.uuid}`, label: c.name, href: `/radars/${c.uuid}`, Icon: Radar } : null;
        }
        case 'radar_scan': {
          const c = ref.content;
          if (!c) return null;
          const parent = references.find((r) => r.type === 'radar' && r.content);
          const parentUuid = parent?.type === 'radar' ? parent.content?.uuid : undefined;
          return {
            key: `scan-${c.uuid}`,
            label: c.title,
            href: parentUuid ? `/radars/${parentUuid}/scans/${c.uuid}` : null,
            Icon: FileText,
          };
        }
        default:
          return null;
      }
    })
    .filter((c): c is RefChip => c !== null);
}

export function ReferenceChips({ references }: { references: ConversationReference[] }) {
  const chips = buildReferenceChips(references);
  if (chips.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground shrink-0 text-xs">About:</span>
      {chips.map((chip) =>
        chip.href ? (
          <Link
            key={chip.key}
            href={chip.href}
            className="border-border text-foreground hover:border-primary/50 hover:bg-muted inline-flex max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
          >
            <chip.Icon className="text-primary h-3 w-3 shrink-0" />
            <span className="truncate">{chip.label}</span>
          </Link>
        ) : (
          <span
            key={chip.key}
            className="border-border text-muted-foreground inline-flex max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
          >
            <chip.Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{chip.label}</span>
          </span>
        ),
      )}
    </div>
  );
}
