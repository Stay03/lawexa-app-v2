import type { Statute, StatuteSourceType } from '@/types/statute';

/**
 * What the reader's header says about where a statute's text came from and
 * whether it is whole (backend contract, 7 October 2026). Pure, so the rules
 * are tested without rendering.
 */

const SOURCE_LABELS: Record<StatuteSourceType, string> = {
  official_gazette: 'Official Gazette',
  official_print: 'Official print',
  authenticated: 'Authenticated',
  unofficial_reproduction: 'Unofficial reproduction',
};

export interface StatuteSourceView {
  /** The badge text. */
  label: string;
  /** Publisher, URL or file name, gazette number and date; null when not written. */
  note: string | null;
  /** False for an unofficial reproduction, which the badge marks as a caution. */
  official: boolean;
}

/**
 * The Source badge, or null when no source is recorded (the page then shows
 * no badge). The API's label wins; a type newer than this build still shows,
 * with its name made readable.
 */
export function statuteSource(statute: Statute): StatuteSourceView | null {
  const type = statute.source_type ?? null;
  const label = statute.source_type_label?.trim() || (type ? SOURCE_LABELS[type] ?? readable(type) : '');
  if (!label) return null;
  return {
    label,
    note: statute.source_note?.trim() || null,
    official: type !== 'unofficial_reproduction',
  };
}

/** The "Incomplete text" notice's words, or null when the text is whole. */
export function incompleteNotice(statute: Statute): string | null {
  if (statute.incomplete_text !== true) return null;
  // The API requires a note with the flag; a missing one still shows the notice.
  return statute.incomplete_note?.trim() || 'Part of this text is missing.';
}

function readable(type: string): string {
  const words = type.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
