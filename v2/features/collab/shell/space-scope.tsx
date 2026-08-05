'use client';

import { createContext, useContext } from 'react';

import type { Member, Space, SpaceType } from '@/types/collab';
import type { RailSections } from './collab-route';

/**
 * space-scope — what the persistent frame knows about the space the reader is
 * in, published DOWN to the page it renders.
 *
 * ── WHY THE PAGE READS THE FRAME AND NOT ITS OWN QUERIES ───────────────────
 * The frame already has to hold the space, its channels and its governance, or
 * the rail could not draw. Left to itself the lobby would mount the same three
 * leaves again — same keys, so no second request, but two components deriving
 * `canManage` from two half-sources, which is exactly the drift the shipped
 * screen's own docblock warns about. One owner, one answer.
 *
 * It also makes the SPACE ROUTE cheaper than it was: the frame's queries are
 * mounted by a layout, so they survive every channel switch, and returning to
 * the lobby paints from a cache that never unmounted.
 *
 * ── AND WHY THE OVERLAYS ARE OPENED THROUGH IT ─────────────────────────────
 * "New channel" exists in four places — the rail's footer, the drawer's
 * footer, the lobby's header and the lobby's empty state — and two of them
 * live in the frame while two live in the page. One dialog at one URL
 * (`?create=channel`) is the only shape in which those four cannot drift; the
 * page therefore asks the frame to open it rather than mounting a second copy
 * at a second address. Same for the roster.
 *
 * A page rendered outside a space (the `/spaces` list, `/channels` index) gets
 * `null`, and its consumers must handle that — the hook returns the scope or
 * `null`, never a fabricated empty one.
 */
/** A crest and a name — the least a surface needs to say WHERE it is. */
export interface CollabSpaceIdentity {
  uuid: string;
  name: string;
  type: SpaceType;
}

export interface CollabSpaceScope {
  /** `''` only in the window where a channel's space is not yet known; every
   *  consumer that spends it is gated on {@link CollabSpaceScope.identity}. */
  spaceUuid: string;
  /** `null` until the space detail lands (or if it failed). */
  space: Space | null;
  /**
   * Crest + name, known as soon as EITHER the space detail or the channel's
   * own `space` ref lands — which on a channel route is a whole round trip
   * earlier than {@link CollabSpaceScope.space}. It is what lets the rail and
   * the header paint the place immediately instead of shimmering twice.
   */
  identity: CollabSpaceIdentity | null;
  /** The space's own three states, so the lobby draws them without re-asking. */
  isSpacePending: boolean;
  isSpaceError: boolean;
  /** 403/404 — a POLICY refusal, distinct from a load failure. */
  spaceErrorStatus: number | null;
  /** The server's own sentence, for a 4xx worth repeating. */
  spaceErrorMessage: string | null;
  retrySpace: () => void;

  /** The space's channels, sectioned by the one shared ordering. */
  sections: RailSections;
  isChannelsPending: boolean;
  isChannelsError: boolean;
  retryChannels: () => void;

  /** The freshest roster available — the members page on the lobby, the
   *  detail's own roster elsewhere. May be empty; never `undefined`. */
  members: readonly Member[];
  /** Only ever true on the space route: the roster page is requested there and
   *  nowhere else, so a channel route reports "not pending" rather than
   *  "pending forever" for a query it deliberately never made. */
  isMembersPending: boolean;

  canManage: boolean;
  isOwner: boolean;

  /** Opens the one create-channel dialog (`?create=channel`). */
  openCreateChannel: () => void;
  /**
   * Opens the SPACE roster sheet (`?roster=1`) — a SPACE-ROUTE affordance.
   * The param is refused elsewhere, because that sheet owns a nested
   * `?invite=` and the channel screen's own roster owns the same param; two
   * owners on one screen and the refusing one strips the other's value. Only
   * the lobby calls this, and only the lobby renders the sheet.
   */
  openRoster: () => void;
  /** Opens the space drawer (`?rail=1`) — the channel list below `lg:`. */
  openRail: () => void;
}

const CollabSpaceScopeContext = createContext<CollabSpaceScope | null>(null);

export function CollabSpaceScopeProvider({
  scope,
  children,
}: {
  scope: CollabSpaceScope | null;
  children: React.ReactNode;
}) {
  return (
    <CollabSpaceScopeContext.Provider value={scope}>
      {children}
    </CollabSpaceScopeContext.Provider>
  );
}

/** The space the frame is holding, or `null` outside one. */
export function useCollabSpaceScope(): CollabSpaceScope | null {
  return useContext(CollabSpaceScopeContext);
}
