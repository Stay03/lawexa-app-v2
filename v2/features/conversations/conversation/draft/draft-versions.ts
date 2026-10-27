import { draftsIn } from './draft-blocks';
import type { DraftSourceMessage } from './draft-ordinals';

/**
 * draft-versions — the drafts in a chat that are versions of one draft (Stay,
 * 27 October 2026, thread 4531c708, option B: "an edit makes a new version of
 * the draft"). When the reader asks Lawexa to change a draft, the answer holds
 * the draft again in full. Its card then reads "Version 2", the older cards are
 * greyed, and the draft panel can switch between the versions.
 *
 * Every version keeps its own place (draft-ordinals.ts), so `?side=draft:N`,
 * the reader's edits, Save as note and Download all stay per version: the
 * switch only opens another ordinal.
 *
 * THE GROUP KEY. Until the tag carries a fixed id (step 2, backend's
 * `<draft title="…" id="…" version="…">`), the drafts of one chat with the same
 * title, compared without case or extra spaces, are one draft. `draftGroupKey`
 * is the one place that decides it, so step 2 swaps the key there and nothing
 * else changes.
 *
 * Pure, so the rules are tested here; the card and the panel only draw them.
 */

export interface DraftVersionEntry {
  ordinal: number;
  key: string;
}

/** Every saved draft in the chat, in order, with its group key. */
export type DraftVersionIndex = readonly DraftVersionEntry[];

export interface DraftVersion {
  /** 1 for the first draft of its group. */
  version: number;
  /** How many versions the group has. */
  count: number;
  /** The group's ordinals, oldest first. */
  ordinals: readonly number[];
  /** No newer version follows this one. */
  latest: boolean;
}

/** Which drafts are one draft: the same title, without case or extra spaces. */
export function draftGroupKey(draft: { title: string }): string {
  return `title:${draft.title.trim().replace(/\s+/g, ' ').toLowerCase()}`;
}

/**
 * The saved drafts of a transcript, counted the way draft-ordinals.ts counts
 * them. The answer still streaming has no text in `content` yet, so its drafts
 * join the index once it is saved; until then `draftVersion` places one by its
 * ordinal, after the saved ones.
 */
export function draftVersionIndex(messages: readonly DraftSourceMessage[]): DraftVersionIndex {
  const entries: DraftVersionEntry[] = [];
  let ordinal = 0;
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    for (const draft of draftsIn(message.content)) {
      entries.push({ ordinal, key: draftGroupKey(draft) });
      ordinal += 1;
    }
  }
  return entries;
}

/** Draft `ordinal`'s place among the versions of its group. */
export function draftVersion(index: DraftVersionIndex, ordinal: number, key: string): DraftVersion {
  const ordinals = index.filter((entry) => entry.key === key).map((entry) => entry.ordinal);
  if (!ordinals.includes(ordinal)) ordinals.push(ordinal);
  ordinals.sort((a, b) => a - b);
  const version = ordinals.indexOf(ordinal) + 1;
  return { version, count: ordinals.length, ordinals, latest: version === ordinals.length };
}

/** "Version 2", for a draft with more than one version; `null` for a draft with one. */
export function draftVersionLabel(version: DraftVersion | null): string | null {
  return version && version.count > 1 ? `Version ${version.version}` : null;
}

/**
 * The name a version saves and downloads under: "Tenancy Agreement (Version 2)"
 * once there is more than one, so two versions are two notes and two files a
 * reader can tell apart; the plain title for a draft with one version.
 */
export function draftVersionTitle(title: string, version: DraftVersion | null): string {
  const label = draftVersionLabel(version);
  return label ? `${title} (${label})` : title;
}
