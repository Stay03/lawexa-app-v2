'use client';

import { useEffect, useState } from 'react';

import { forgetOtherOwners } from './device-store';
import { armOutboxStorage, outboxForget } from './send-outbox';

/**
 * ChannelDeviceSweep — the channels feature's device storage, pointed at
 * whoever is signed in right now. Renders nothing. 2026-08-06.
 *
 * ── WHY IT IS NOT IN THE COMPOSER ──────────────────────────────────────────
 * It was, and that was the bug. Both halves — taking the previous reader's
 * drafts off the disk (`./device-store.ts`) and pointing the unsent-message
 * outbox at this account (`./send-outbox.ts`) — hung off `ChannelComposerBody`,
 * which renders only under `canParticipate`. So A signed out, B signed in, and
 * as long as B stayed on the home, a case, a note, or a channel they may only
 * READ, none of it ran: A's drafts and A's unsent message text sat on the device
 * for B's whole session, and A's unsent rows sat in the store's memory — where
 * `ChannelFeed` reads them unconditionally and merges them into a transcript
 * that, on a cold cache, has nothing else in it. A's words, under A's name, in
 * B's window.
 *
 * SO IT MOUNTS WHERE THE OTHER IDENTITY BOUNDARY MOUNTS: beside
 * `V2CacheIdentityGuard` in `app/v2/layout.tsx`, above every v2 route, fed the
 * same server-verified `userId`. Nothing about a channel is special enough to
 * own this — what is special is the moment the account changes, and that moment
 * belongs to the layout.
 *
 * ── ONE THING IN RENDER, THE REST IN AN EFFECT, AND THE ORDER MATTERS ──────
 * FORGETTING happens in render, exactly as the cache guard clears the query
 * cache in render and for the same reason: an effect runs one commit late, and
 * one commit is long enough for the tree below to paint the previous account's
 * message. This component renders BEFORE the routes below it in the same pass,
 * so by the time anything reads the store it is already empty. `outboxForget()`
 * is a memory-only external-store write that notifies nobody, so it schedules no
 * update during anyone's render (React #185's neighbour) and touches no disk.
 *
 * HYDRATING happens in an effect, because it cannot happen in render:
 * `localStorage` is browser-only, and the store's `getServerSnapshot` has to
 * keep answering "nothing" until the browser has actually looked or the first
 * client snapshot would disagree with the server's.
 *
 * NOTHING CAN RACE THE FIRST WRITE. The sweep only ever removes keys belonging
 * to OTHER accounts (plus this account's own expired ones), so a composer that
 * mounts first and saves a draft in a child effect — children run before parents
 * — writes a key this pass would never have touched. And the outbox has nothing
 * to lose to it either: a send needs a gesture, which is many frames after every
 * effect in the mounting commit has run.
 */
export function ChannelDeviceSweep({ userId }: { userId: number | null }) {
  const [seen, setSeen] = useState<number | null>(userId);

  if (seen !== userId) {
    setSeen(userId);
    outboxForget();
  }

  useEffect(() => {
    // Sweep first, then hydrate. They cannot collide — the sweep never touches
    // this owner's live keys — but reading the disk after clearing it is the
    // order a reader will expect to find here.
    if (userId !== null) forgetOtherOwners(userId);
    armOutboxStorage(userId);
  }, [userId]);

  return null;
}
