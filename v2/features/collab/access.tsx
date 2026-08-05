'use client';

import type { Channel } from '@/types/collab';
import { useV2Session } from '@/v2/runtime/session-context';
import { LIST_COLUMN } from '@/v2/shell/page-columns';
import { collabAccessState } from './model';
import { CollabCreateAccountState, CollabSignedOutState } from './ui/states';
import { CollabVerifyEmailState } from './ui/VerifyEmailState';

/**
 * CollabAccessGate — the ONE audience gate for every `/spaces/*` and
 * `/channels/*` surface. Mounted ONCE, in `app/v2/(collab)/layout.tsx` — the
 * route group both address families now live under — so it decides before any
 * collab screen, query or route fallback below it exists. It used to be
 * mounted twice, once per segment, with a comment promising the two doors
 * could never drift; there is one door now, so they cannot. The exact
 * `QuizAccessGate` pattern; audience per owner decision D1 (2026-08-04); plan
 * W1 item 7.
 *
 * SYNCHRONOUS, AND THAT IS THE WHOLE POINT: `useV2Session()` reads a snapshot
 * the SERVER already resolved before this tree mounted, so the decision is
 * available on the first frame. v1's `SpacesGuard` waited for the auth store
 * to rehydrate and then `router.replace('/')`-ed outsiders — a fake loading
 * state ending in a silent bounce, both DROPPED by the study (A0). No
 * skeleton, no flash, no redirect: refusals are designed states.
 *
 * THE THREE REFUSALS ARE DIFFERENT ANSWERS:
 *  - signed out → "sign in" (the door opens once you do);
 *  - guest → the create-an-account panel (registering IS the door);
 *  - unverified email → the verify panel, the one gate the backend actually
 *    enforces on collab (queries below stay `enabled: false` in this state —
 *    the collab model's `eligible` check is the same predicate everywhere).
 *
 * NOT a security boundary: the backend gates on membership + verified email,
 * not on role, and does not block guest tokens (study §1 item 6). The
 * server-side guest block is the coordinator's backend ask; until it lands
 * this gate is the UX, described as exactly that in the panels' copy.
 */
export function CollabAccessGate({ children }: { children: React.ReactNode }) {
  const session = useV2Session();

  switch (collabAccessState(session)) {
    case 'signed-out':
      return (
        <div className={LIST_COLUMN}>
          <CollabSignedOutState />
        </div>
      );
    case 'create-account':
      return (
        <div className={LIST_COLUMN}>
          <CollabCreateAccountState />
        </div>
      );
    case 'verify-email':
      return (
        <div className={LIST_COLUMN}>
          <CollabVerifyEmailState />
        </div>
      );
    case 'eligible':
      return <>{children}</>;
  }
}

/* ══ Channel access ═══════════════════════════════════════════════════════ */

/**
 * Where the viewer stands in ONE channel.
 *  - `member`  — an active channel member: the whole room.
 *  - `preview` — an active member of the SPACE reading a `space_public`
 *    channel they never joined: everything readable, nothing writable.
 *  - `closed`  — a private channel they are not in. The designed refusal.
 */
export type ChannelAccessState = 'member' | 'preview' | 'closed';

/**
 * What the viewer may do in this channel.
 *
 * ── WHY `preview` EXISTS (backend ruling, 2026-08-04) ──────────────────────
 * Public channels are now readable BEFORE joining — for members of the space,
 * and only for them. Spaces themselves stay invite-only, so there is still no
 * way to reach a space you are not in; the preview is a door inside a building
 * you already hold a key to.
 *
 * ── HOW WE KNOW THE READER IS A SPACE MEMBER ──────────────────────────────
 * We never ask. `GET /channels/{uuid}` refuses an outsider with a 403, so
 * HOLDING a `space_public` channel object is itself the proof — the screen's
 * 403 branch is where an outsider is turned away, before this function is ever
 * called. There is no viewer-scoped "space role" on the channel resource to
 * read, and inventing one would only be a second, weaker copy of a check the
 * server already made.
 *
 * THIS ARGUMENT IS SCOPED TO `space_public` ON PURPOSE. It says nothing about
 * what the server does with a PRIVATE channel, which is the open question
 * below.
 *
 * ── OPEN QUESTION: DOES A PRIVATE CHANNEL'S DETAIL 403? ───────────────────
 * `closed` exists because the pre-preview screen believed a space member could
 * load a private channel's detail and be refused its contents in the UI. That
 * belief is INHERITED, NOT MEASURED. The backend ruling says private channels
 * are "members only, no preview, not even for space admins", which reads like
 * the detail is refused too; the API digest says channel detail is visible to
 * "members and space governors / platform admins", which reads like it is not,
 * at least for governors. Settling it needs two accounts in one space, which
 * nobody has had yet.
 *
 * So BOTH shapes are handled and NEITHER is asserted in copy: a 403 lands on
 * the screen's access-denied panel, a 200 on the private-channel panel, and
 * both sentences are true whichever way it turns out. Do not collapse the two
 * paths, and do not write copy that names the wall, until it has been
 * measured — an unreachable branch costs nothing, and a refusal that tells the
 * reader the wrong thing about their own space costs trust.
 *
 * ── OPEN IN PREVIEW (measured against the backend's ruling) ────────────────
 * message history · pinned messages · the member roster · channel details ·
 * the AI session list and any session's transcript.
 *
 * ── CLOSED IN PREVIEW, AND NEVER REQUESTED ────────────────────────────────
 * posting · replying · reacting · pinning · bookmarking (including the saved
 * list) · uploading · THE FILE LIST · task-list ticking · joining a quiz · the
 * read pointer `POST /read` · AI session reset.
 *
 * NOT REQUESTED is half the contract. A 403 arriving inside a live query is a
 * broken screen — a spinner that resolves into an error panel — not a designed
 * refusal. So every blocked read is gated by NOT MOUNTING the surface that
 * fetches it, and every blocked write by not rendering the control at all.
 * Present-and-failing is the one shape this model forbids.
 *
 * ── TASK LISTS ARE BLOCKED HERE, DELIBERATELY ─────────────────────────────
 * The ruling names list TICKING as blocked and says nothing about the list
 * READ. An unnamed read is not an open read, so lists are treated as closed
 * until the backend says otherwise — the cost of being wrong that way is one
 * tab a previewer cannot open, and the cost of being wrong the other way is a
 * 403 in a live query. It has its OWN capability rather than riding
 * `canParticipate` precisely so that confirming the read is a one-line change
 * here (the screen derives the Lists tab from it, and `ListsTab` would then
 * need its ticking and its composer gated the way the feed's are).
 *
 * ── TWO CONSEQUENCES WORTH STATING ────────────────────────────────────────
 * The read pointer is off, so a previewer HAS NO UNREAD STATE — no
 * `unread_count` rides the channel, no unread divider is drawn, and nothing
 * may assume one exists. And the presence room admits active channel members
 * only (`presence-channels.{uuid}` refuses everyone else), so a preview is a
 * STATIC read: no typing line, no live arrivals, no online count. Both are
 * honest, and the join affordance is what changes them.
 */
export interface ChannelAccess {
  /** `preview` is also exactly the JOINABLE state — a public channel, a space
   *  member, not yet in — so there is no separate `canJoin`. */
  state: ChannelAccessState;
  /** May read the transcript, the pins, the roster and the AI history. */
  canRead: boolean;
  /** May write anything at all — post, engage, upload, tick, play, mark read. */
  canParticipate: boolean;
  /** May read this channel's task lists. Blocked in preview (see above). */
  canReadLists: boolean;
}

/** Resolve {@link ChannelAccess} from a channel the server has already
 *  released to this viewer. Pure — the screen calls it in render. */
export function channelAccess(
  channel: Pick<Channel, 'is_member' | 'visibility'>,
): ChannelAccess {
  if (channel.is_member === true) {
    return {
      state: 'member',
      canRead: true,
      canParticipate: true,
      canReadLists: true,
    };
  }
  if (channel.visibility === 'space_public') {
    return {
      state: 'preview',
      canRead: true,
      canParticipate: false,
      canReadLists: false,
    };
  }
  return {
    state: 'closed',
    canRead: false,
    canParticipate: false,
    canReadLists: false,
  };
}
