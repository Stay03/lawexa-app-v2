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
