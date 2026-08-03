/**
 * server-outline — map the backend's AKN outline endpoint (every element in
 * reading order, no body text, per-entry `locked` flags) into the reader's
 * wayfinding shapes.
 *
 * WHY THIS EXISTS: on a PARTIAL document the client-derived outline can only
 * know the rendered excerpt — the map would end where the free text ends. The
 * server outline knows the whole document, so the contents rail can show the
 * full table of contents with the locked reaches marked (the list of locked
 * section titles IS the honest upsell), and a citation link into the locked
 * region can be told apart from a citation to a provision that genuinely does
 * not exist.
 *
 * THE MAPPING MIRRORS `akn.ts`'s ModelBuilder EXACTLY — same division
 * vocabulary ({@link STRUCTURAL} plus `schedule`, the outline's name for what
 * the XML walk meets as `attachment`), same section vocabulary
 * ({@link SECTION_GRADE}), same label joins, same "only labelled divisions
 * earn an entry; sections attach to the nearest labelled ancestor" rule, and
 * the same `akn-{eId}` anchors — so on the rendered excerpt the two outlines
 * agree entry for entry, and a swap from one to the other moves nothing.
 *
 * Pure data → data; no DOM, no React. Sizes are small (719 entries measured
 * for the biggest Act) — plain linear scans throughout.
 */

import type { StatuteOutlineData, StatuteOutlineEntry } from '@/lib/api/statutes';
import { SECTION_GRADE, STRUCTURAL, type AknOutlineDivision } from './akn';
import {
  formatProvisionLabel,
  isCitableNum,
  normalizeNum,
  type ProvisionCitation,
} from './provision';

/* ── Model ───────────────────────────────────────────────────────────────── */

export interface ServerOutlineModel {
  /** The full contents tree — the rail/sheet render this in place of the
   *  client-derived outline, locked entries flagged. */
  divisions: AknOutlineDivision[];
  /** Anchor ids (`akn-{eId}`) of EVERY locked entry, at every depth — the
   *  jump interceptor and the hash-arrival check both key on it. */
  lockedAnchorIds: ReadonlySet<string>;
  /** The document's true section count, or null when the payload's count is
   *  unusable — the upgrade card's headline falls back through this. */
  totalSections: number | null;
}

/* ── Vocabulary (the walk's, restated for outline node types) ────────────── */

/** Division-grade node types: the XML walk's {@link STRUCTURAL} set, plus
 *  `schedule` — the outline's node type for the attachments the walk lifts
 *  into top-level divisions. */
const DIVISION_GRADE: ReadonlySet<string> = new Set([...STRUCTURAL, 'schedule']);

/* ── Helpers ─────────────────────────────────────────────────────────────── */

/** `joinNumHeading`, restated for the outline's `number`/`title` fields. */
function joinLabel(
  number: string | null,
  title: string | null,
  separator: string,
): string {
  const num = number?.trim() ?? '';
  const text = title?.trim() ?? '';
  if (num && text) return `${num}${separator}${text}`;
  return num || text;
}

/** The entry's `akn-{eId}` anchor — the same id the rendered document stamps
 *  (eIds are unchanged between the outline and the XML export). The position
 *  fallback keeps an eId-less entry keyable; it can never match a DOM anchor,
 *  which is the honest outcome for an element nothing can address. */
function anchorIdOf(entry: StatuteOutlineEntry): string {
  return entry.eId ? `akn-${entry.eId}` : `akn-pos-${entry.position}`;
}

/* ── The mapping ─────────────────────────────────────────────────────────── */

export function buildServerOutline(data: StatuteOutlineData): ServerOutlineModel {
  const divisions: AknOutlineDivision[] = [];
  const lockedAnchorIds = new Set<string>();
  /** Open structural containers, outermost first — `division: null` marks an
   *  UNLABELLED one (kept on the stack purely so depths stay honest; exactly
   *  the walk's "sections attach to the nearest labelled ancestor"). */
  const stack: Array<{ depth: number; division: AknOutlineDivision | null }> = [];

  for (const entry of data.outline) {
    if (entry.locked) lockedAnchorIds.add(anchorIdOf(entry));

    // Structural containers cannot nest inside sections, so any frame at this
    // depth or deeper is finished the moment an entry at this depth arrives.
    if (DIVISION_GRADE.has(entry.node_type) || SECTION_GRADE.has(entry.node_type)) {
      while (stack.length > 0 && stack[stack.length - 1].depth >= entry.depth) {
        stack.pop();
      }
    }

    if (DIVISION_GRADE.has(entry.node_type)) {
      const label = joinLabel(entry.number, entry.title, ' — ');
      if (label) {
        const division: AknOutlineDivision = {
          id: anchorIdOf(entry),
          label,
          sections: [],
          ...(entry.locked ? { locked: true } : {}),
        };
        divisions.push(division);
        stack.push({ depth: entry.depth, division });
      } else {
        // Anonymous subpart — no rail row, but its frame keeps sections
        // attaching to the nearest LABELLED ancestor, as in the walk.
        stack.push({ depth: entry.depth, division: null });
      }
      continue;
    }

    if (SECTION_GRADE.has(entry.node_type)) {
      const label = joinLabel(entry.number, entry.title, ' ');
      if (!label) continue; // the walk skips unlabelled sections too
      const section = {
        id: anchorIdOf(entry),
        label,
        ...(entry.locked ? { locked: true } : {}),
      };
      let holder: AknOutlineDivision | null = null;
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].division) {
          holder = stack[i].division;
          break;
        }
      }
      if (holder) {
        holder.sections.push(section);
      } else {
        // A flat act (sections straight under the body): the sections ARE the
        // outline's top level — the walk's exact rule.
        divisions.push({ ...section, sections: [] });
      }
      continue;
    }

    // Everything else (crossheadings, subsections, paragraphs, containers …)
    // is not wayfinding — same as the client outline.
  }

  return {
    divisions,
    lockedAnchorIds,
    totalSections:
      Number.isInteger(data.total_sections) && data.total_sections > 0
        ? data.total_sections
        : null,
  };
}

/* ── Locked-citation lookup ──────────────────────────────────────────────── */

/**
 * Does this citation point into the LOCKED region of a partial document?
 *
 * Consulted only AFTER client-side resolution failed (the rendered excerpt
 * wins whenever it holds the num — the same first-wins order
 * `indexSections` enforces). Returns the human label to speak about
 * (`"Section 54"` / `"Section 54(2)"`) when the outline's first section-grade
 * holder of the num is locked; the subsection variant is claimed only when
 * the outline CONFIRMS that subsection inside the section's span — otherwise
 * the section-level label is the most this function can honestly say. `null`
 * when the num has no holder (genuinely absent — the existing not-found
 * notice stands) or its first holder is unlocked (a skew this module does not
 * paper over).
 */
export function findLockedCitation(
  data: StatuteOutlineData,
  citation: ProvisionCitation,
): { label: string } | null {
  const entries = data.outline;

  let holderIndex = -1;
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!SECTION_GRADE.has(entry.node_type)) continue;
    const num = normalizeNum(entry.number ?? '');
    if (!isCitableNum(num)) continue;
    if (num === citation.section) {
      holderIndex = i;
      break;
    }
  }
  if (holderIndex === -1) return null;

  const holder = entries[holderIndex];
  if (!holder.locked) return null;

  const sectionLabel = formatProvisionLabel({
    section: citation.section,
    subsection: null,
  });
  if (!citation.subsection) return { label: sectionLabel };

  // The section's span: every following entry deeper than the section.
  for (
    let i = holderIndex + 1;
    i < entries.length && entries[i].depth > holder.depth;
    i += 1
  ) {
    const entry = entries[i];
    if (entry.node_type !== 'subsection') continue;
    if (normalizeNum(entry.number ?? '') === citation.subsection) {
      return { label: formatProvisionLabel(citation) };
    }
  }
  return { label: sectionLabel };
}
