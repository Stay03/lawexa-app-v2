import {
  draftsIn,
  mayHoldDraft,
  splitDrafts,
  type DraftBlock,
} from '@/v2/features/conversations/conversation/draft/draft-blocks';

/**
 * report-drafts — the drafts a Radar wrote into a report (plan 5.5, Backend's
 * B3, 26 October 2026). The body holds `<draft title="…">` blocks exactly as a
 * chat answer does, so `splitDrafts` reads them unchanged.
 *
 * THE ORDINAL. A saved draft is one note per draft of a chat: the server keys
 * it on (reader, chat, draft number). A Radar's reports are answers in one
 * chat, the Radar's own, so a draft's number is its place among every draft
 * in that chat: `draft_offset` (how many the Radar's earlier reports hold,
 * counted by the server) plus its place in this report. Without the offset two
 * reports' first drafts would both be number 0 and save into one note, so a
 * report without it shows its drafts in place, with nothing to save.
 *
 * Pure, so the test can run it; the report screen and its panel draw it.
 */

export type ReportPart =
  | { kind: 'text'; text: string }
  | { kind: 'draft'; draft: DraftBlock; ordinal: number };

/** The report, split into its text and its drafts, each draft numbered. */
export function reportParts(narrative: string, draftOffset: number): ReportPart[] {
  if (!mayHoldDraft(narrative)) return [{ kind: 'text', text: narrative }];
  let index = 0;
  return splitDrafts(narrative).map((part) =>
    part.kind === 'text' ? part : { kind: 'draft', draft: part.draft, ordinal: draftOffset + index++ },
  );
}

/** Draft number `ordinal` of the Radar's chat, when it is one of this report's. */
export function reportDraftAt(narrative: string, draftOffset: number, ordinal: number): DraftBlock | null {
  const index = ordinal - draftOffset;
  if (!Number.isInteger(index) || index < 0) return null;
  return draftsIn(narrative)[index] ?? null;
}
