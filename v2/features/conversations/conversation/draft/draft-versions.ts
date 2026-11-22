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
 * THE GROUP KEY (`draftGroupKey`, the one place that decides it). A draft
 * whose tag carries a fixed id (backend's prompt cfeb49c8,
 * `<draft title="…" id="k3f9q2" version="2">`) groups with every draft of that
 * id, whatever its title. A draft without one, every chat from before the id
 * and any answer that leaves it out, groups by title within the chat,
 * compared without case or extra spaces. The tag's own version number is not
 * read for the label: the app counts a draft's place in its group, so a
 * skipped or repeated number still reads right.
 *
 * Pure, so the rules are tested here; the card and the panel only draw them.
 */

export interface DraftVersionEntry {
  ordinal: number;
  key: string;
  /** The title this version was written under. */
  title: string;
  /** The draft's closing tag arrived: a version cut off (Lawexa stopped) is not finished. */
  finished: boolean;
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
  /**
   * A newer FINISHED version follows, so this one is greyed as older. A
   * version cut off when Lawexa was stopped never greys the one before it:
   * that one stays the newest the reader can edit (Frontend's review, 29
   * October 2026; the panel's `newestFinished` agrees).
   */
  superseded: boolean;
}

const normalTitle = (title: string) => title.trim().replace(/\s+/g, ' ').toLowerCase();

/** Which drafts are one draft: the same fixed id, else the same title without case or extra spaces. */
export function draftGroupKey(draft: { title: string; id?: string | null }): string {
  if (draft.id) return `id:${draft.id}`;
  return `title:${normalTitle(draft.title)}`;
}

/** A draft as the group rule reads it: its title, and the tag's id and version. */
export interface KeyedDraft {
  title: string;
  id?: string | null;
  version?: number | null;
}

/**
 * The group key of every draft in a chat, answer by answer, oldest first
 * (Arthur, 22 November 2026; the rule agreed with Backend, whose draft
 * documents use the same keys). Lawexa sometimes gave many different
 * documents one id: one chat held 15 documents under one id, filed as
 * versions of one draft. Walking the drafts in chat order, per id, with the
 * titles of its group and whether it has split:
 * 1. an id not seen yet: `id:<id>`, and its title joins the id's titles;
 * 2. an id already split: `id:<id>|title:<title>`;
 * 3. a title already among the id's titles: `id:<id>` (a real version);
 * 4. a new title with version missing or 1, or with the id used earlier in the
 *    SAME answer (one answer never holds two versions of a document): the id
 *    splits, `id:<id>|title:<title>`;
 * 5. otherwise (a new title, version 2 or more, a later answer): `id:<id>`, a
 *    version Lawexa renamed, and its title joins the id's titles.
 * A draft without an id groups by title, as before. Titles are compared
 * trimmed, with spaces collapsed, without case.
 */
export function chatDraftKeys(answers: readonly (readonly KeyedDraft[])[]): string[][] {
  const titles = new Map<string, Set<string>>();
  const split = new Set<string>();
  return answers.map((drafts) => {
    const inThisAnswer = new Set<string>();
    return drafts.map((draft) => {
      if (!draft.id) return draftGroupKey(draft);
      const id = draft.id;
      const title = normalTitle(draft.title);
      const own = `id:${id}|title:${title}`;
      const earlierHere = inThisAnswer.has(id);
      inThisAnswer.add(id);
      const known = titles.get(id);
      if (!known) {
        titles.set(id, new Set([title]));
        return `id:${id}`;
      }
      if (split.has(id)) return own;
      if (known.has(title)) return `id:${id}`;
      if ((draft.version ?? 0) <= 1 || earlierHere) {
        split.add(id);
        return own;
      }
      known.add(title);
      return `id:${id}`;
    });
  });
}

/** Every saved answer's draft keys, by message id (chatDraftKeys over the transcript). */
export function draftKeysByMessage(messages: readonly DraftSourceMessage[]): Map<string, string[]> {
  const answers = messages.filter((message) => message.role === 'assistant');
  const keys = chatDraftKeys(answers.map((message) => draftsIn(message.content)));
  return new Map(answers.map((message, i) => [message.id, keys[i]]));
}

/**
 * One answer's draft keys in the chat's order: a saved answer's from the
 * transcript; an answer still arriving continues the walk after the saved
 * ones, so its cards already read right.
 */
export function draftKeysFor(messages: readonly DraftSourceMessage[], messageId: string | null, drafts: readonly KeyedDraft[]): string[] {
  const answers = messages.filter((message) => message.role === 'assistant' && message.id !== messageId);
  const keys = chatDraftKeys([...answers.map((message) => draftsIn(message.content)), drafts]);
  return keys[keys.length - 1];
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
  const answers = messages.filter((message) => message.role === 'assistant');
  const drafts = answers.map((message) => draftsIn(message.content));
  const keys = chatDraftKeys(drafts);
  drafts.forEach((answer, a) =>
    answer.forEach((draft, i) => {
      entries.push({ ordinal, key: keys[a][i], title: draft.title, finished: draft.complete });
      ordinal += 1;
    }),
  );
  return entries;
}

/** Draft `ordinal`'s place among the versions of its group. */
export function draftVersion(index: DraftVersionIndex, ordinal: number, key: string): DraftVersion {
  const ordinals = index.filter((entry) => entry.key === key).map((entry) => entry.ordinal);
  if (!ordinals.includes(ordinal)) ordinals.push(ordinal);
  ordinals.sort((a, b) => a - b);
  const version = ordinals.indexOf(ordinal) + 1;
  const superseded = index.some((entry) => entry.key === key && entry.ordinal > ordinal && entry.finished);
  return { version, count: ordinals.length, ordinals, latest: version === ordinals.length, superseded };
}

/** The title of a group's newest version (a draft's title may change between versions); `null` for an unknown group. */
export function draftGroupTitle(index: DraftVersionIndex, key: string): string | null {
  return index.findLast((entry) => entry.key === key)?.title ?? null;
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
