import type { Channel } from '@/types/collab';

/**
 * thread-model — the pure vocabulary of a thread. No JSX, no hooks: the header,
 * the feed, the composer's label, the shell frame and the mention toast all read
 * from here, so none of them can decide for itself what a thread is called or
 * where its way back goes.
 *
 * ── WHY `channelDisplayName` EXISTS AT ALL ─────────────────────────────────
 * `channels` carries `UNIQUE(space_id, name)`, so the server cannot give a
 * thread a human name: it creates one as `thread--{uuid}` and puts the words in
 * a separate `title` column. `ChannelResource`'s own docblock says "the `name`
 * is a generated slug — do not show it to anyone". Every surface that printed
 * `channel.name` would therefore print `thread--0f3a1c22-…` the moment a reader
 * opened a thread — and threads shipped to production before any of this UI
 * existed, so that was live, not hypothetical.
 *
 * ONE FUNCTION, NOT A CONVENTION. A rule that says "remember to check
 * `is_thread` first" is a rule that will be forgotten by the next surface that
 * needs a name. This is the only thing allowed to read `channel.name` for
 * display; everything else reads this.
 */
export function channelDisplayName(
  channel: Pick<Channel, 'is_thread' | 'title' | 'name'>,
): string {
  if (!channel.is_thread) return channel.name;
  // `title` is never blank server-side (`threadTitle()` falls back to the
  // root's snippet and then to the literal "Thread", and refuses a cold thread
  // with no title at all), so `??` covers the field being absent rather than
  // being empty.
  return channel.title ?? channel.name;
}

/**
 * "Thread in {parent}" - the one phrase that says where a thread branched
 * from, shared by the phone bar's subtitle and the space digest's second line
 * so a thread's provenance is worded once. `null` when the parent's name is
 * not on the payload (the field postdates the first threads deploy), so each
 * caller states its own fallback rather than printing "Thread in ".
 */
export function threadProvenanceLabel(
  parentName: string | null | undefined,
): string | null {
  const name = parentName?.trim();
  return name ? `Thread in ${name}` : null;
}

/**
 * How many people have spoken in a thread - which is what following IS here,
 * so the count and the word agree. `0` is a real value and reads as one: a
 * branch nobody has answered yet has no followers, not "0 following". Shared
 * by the channel's threads sheet and the space digest's thread row.
 */
export function followerLabel(count: number): string {
  if (count === 0) return 'Nobody following yet';
  return `${count} following`;
}

/**
 * The second line of the phone bar — what a channel is FOR, in one line.
 *
 * The description wins, because that is what the reader wants to know; a thread
 * says where it branched from, because that is what a reader who landed in one
 * from a mention wants; and a plain channel with no description falls back to
 * who can see it, which the lock glyph beside it can only imply.
 *
 * IT IS HERE RATHER THAN IN THE HEADER because two surfaces print it now: the
 * live bar, and the loading frame that draws the same bar from the row the
 * reader tapped. A subtitle that differed between them would be the frame
 * saying one thing and the header saying another, one paint apart.
 */
export function channelPhoneSubtitle(
  channel: Pick<Channel, 'description' | 'visibility_label'>,
  /** The parent's name when this is a thread; `null` otherwise. */
  parentName: string | null,
): string {
  const description = channel.description?.trim() || null;
  return description ?? threadProvenanceLabel(parentName) ?? channel.visibility_label;
}

/**
 * Where a thread's way back goes: the parent channel, landing on the message
 * this thread branched out of.
 *
 * THE `?m=` IS THE POINT. It reuses the deep-link resolver the mention toast and
 * the push notification already run on, so the parent opens scrolled to the
 * branched message and flashes it. What is restored is the PLACE in the
 * conversation, not a pixel offset — the same promise a notification link makes.
 *
 * `null` when there is nothing to go back to: an ordinary channel, or a thread
 * whose payload was trimmed to metadata for a reader who may not read it. A
 * thread with no root (started cold, or its root hard-deleted) still has a
 * parent, and lands on it plainly.
 */
/**
 * The three states a thread can be in for one reader, in the grammar Phase 2
 * settled on and `ThreadLine` (`feed/MessageRow.tsx`) already draws:
 *
 *   'none'      not following → muted title. You have never spoken here; the
 *               thread is a door, not an obligation.
 *   'caught-up' following, nothing new → full-strength title.
 *   'behind'    following, and behind → semibold title + the house gold dot.
 *
 * WEIGHT SAYS "DO YOU BELONG", THE DOT SAYS "IS THERE SOMETHING NEW". A gold
 * NUMBER means a mention and only ever a mention in this product, so neither
 * surface spends one on an unread tally.
 *
 * TWO PAYLOAD SHAPES, ONE GRAMMAR, WHICH IS WHY THIS IS HERE. Under a message
 * the thread arrives as a {@link MessageThreadStub} whose `my_unread_count` is
 * `null` for a non-follower; in the threads list it arrives as a whole Channel,
 * where following is `is_member` and the tally is `unread_count` — and a
 * non-follower's row OMITS both counts entirely (measured on prod 2026-08-12:
 * `is_member: false`, no `unread_count`, no `mention_count`,
 * `active_members_count: 0`). Reading `unread_count ?? 0` alone would therefore
 * report a stranger's thread as "following, caught up", which is the one state
 * the weight is supposed to rule out.
 *
 * MUTE IS NOT APPLIED, unlike `channelUnreadGrammar` for an ordinary channel.
 * That is deliberate and matches `ThreadLine`: a thread's membership row exists
 * only because the reader posted in it, so its notify level is not a decision
 * anybody made about this tangent, and quieting the dot on it would hide the
 * news the space rollup is already counting.
 */
export type ThreadUnreadState = 'none' | 'caught-up' | 'behind';

export function threadUnreadState(
  thread: Pick<Channel, 'is_member' | 'unread_count'>,
): ThreadUnreadState {
  if (thread.is_member !== true) return 'none';
  return (thread.unread_count ?? 0) > 0 ? 'behind' : 'caught-up';
}

export function threadParentHref(
  channel: Pick<Channel, 'is_thread' | 'parent_channel_uuid' | 'root_message'>,
): string | null {
  if (!channel.is_thread) return null;
  const parentUuid = channel.parent_channel_uuid;
  if (!parentUuid) return null;
  const rootUuid = channel.root_message?.uuid;
  return rootUuid
    ? `/channels/${parentUuid}?m=${rootUuid}`
    : `/channels/${parentUuid}`;
}
