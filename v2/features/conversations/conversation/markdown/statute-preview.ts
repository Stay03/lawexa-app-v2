import type { StatuteNavigateResponse } from '@/types/statute';
import { parseProvisionSegment } from '@/v2/features/statutes/reader/provision';
import type { StatuteLinkTarget } from './document-links';

/**
 * A badge's pane for a section of ANOTHER statute (Arthur, 19 October 2026:
 * "many a times the preview doesn't come with the provision and proper
 * information. It just gives the section number"; the same in a normal chat,
 * where no statute page is open). The pane reads the section from the server
 * when it opens; this file turns that answer into the pane's words.
 */

/** The longest opening the pane shows, cut at a word. */
export const PREVIEW_CHARS = 280;

/** How long a section's preview is kept: a statute's text does not change in a session. */
export const PREVIEW_STALE_MS = 60 * 60 * 1000;

/**
 * The server path for the link's section, `section-{num}`: the section alone,
 * as a subsection link (`section-54-2`) previews its section. Null for a link
 * to the whole statute, or a segment that is not a section citation.
 */
export function previewPath(target: Pick<StatuteLinkTarget, 'provision'>): string | null {
  const cited = target.provision ? parseProvisionSegment(target.provision) : null;
  return cited ? `section-${cited.section}` : null;
}

/** A section's text as plain words: tags dropped, entities and spaces collapsed. */
export function plainWords(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** The opening words, at most `max` characters, cut at a word and marked with "…". */
export function openingWords(raw: string | null | undefined, max = PREVIEW_CHARS): string | null {
  if (!raw) return null;
  const words = plainWords(raw);
  if (!words) return null;
  if (words.length <= max) return words;
  const cut = words.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.]+$/, '')}…`;
}

export interface SectionPreview {
  /** The statute's name, its short title where it has one. */
  name: string | null;
  /** The section's own heading ("Fiduciary interests of a secretary"), or null. */
  heading: string | null;
  /** Its opening words, or null when the section has no text of its own. */
  text: string | null;
}

/** The pane's words from the server's answer. */
export function sectionPreview(data: StatuteNavigateResponse['data']): SectionPreview {
  const statute = data.statute ?? null;
  const name = statute ? (statute.short_title?.trim() || statute.title?.trim() || null) : null;
  const heading = data.node.title?.trim() || null;
  const text = openingWords(data.node.intro?.trim() ? data.node.intro : data.node.content);
  return { name, heading, text };
}
