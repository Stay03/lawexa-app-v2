/**
 * Channels REST client — Spaces, Channels and Messages.
 *
 * Every method returns the raw `{ success, message, data, … }` envelope (the
 * axios interceptor does not unwrap it), matching the rest of `lib/api`.
 * Routes and shapes follow the production contract in
 * `docs/channels/phases/phase-1-foundations/api-contract.md`.
 */

import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type {
  AddListItemPayload,
  AiSessionListResponse,
  AiSessionTranscriptResponse,
  BookmarkToggleResponse,
  ChannelFileListResponse,
  ChannelFileResponse,
  ChannelInvitationListResponse,
  ChannelListParams,
  ChannelListResponse,
  ChannelMemberListResponse,
  ChannelResponse,
  CreateChannelPayload,
  CreateInviteLinkPayload,
  CreateListPayload,
  CreateOrganizationPayload,
  CreateSpacePayload,
  CreateThreadPayload,
  DiscoverSpacesParams,
  DiscoverSpacesResponse,
  InviteAcceptResponse,
  InviteLinkListResponse,
  InviteLinkResponse,
  InviteMemberPayload,
  InvitePreviewResponse,
  JoinRequestListResponse,
  MarkReadResponse,
  MemberListParams,
  MemberResponse,
  MessageListParams,
  MessageListResponse,
  MessageRepliesResponse,
  MessageResponse,
  MyOrganizationResponse,
  NotifyLevelPayload,
  OrganizationInvitationListResponse,
  OrganizationMemberListResponse,
  OrganizationResponse,
  PinToggleResponse,
  PinnedMessageListResponse,
  ReactionToggleResponse,
  ReorderListItemsPayload,
  RequestVerificationPayload,
  SavedMessageListResponse,
  SendMessagePayload,
  SendMessageResponse,
  SpaceInvitationListResponse,
  SpaceListParams,
  SpaceListResponse,
  SpaceMemberListResponse,
  SpaceResponse,
  TaskListItemResponse,
  TaskListItemsResponse,
  TaskListResponse,
  TaskListSummaryListResponse,
  ToggleReactionPayload,
  TransferOwnershipPayload,
  UpdateChannelPayload,
  UpdateListItemPayload,
  UpdateListPayload,
  UpdateMemberRolePayload,
  UpdateMessagePayload,
  UpdateOrganizationPayload,
  UpdateSpacePayload,
} from '@/types/collab';

/** Pagination params for the invitation inboxes. */
interface PageParams {
  per_page?: number;
  page?: number;
}

/** Spaces are bound by uuid; channels are listed under their space. */
export const spacesApi = {
  getList: async (params: SpaceListParams = {}): Promise<SpaceListResponse> => {
    const response = await apiClient.get<SpaceListResponse>('/spaces', {
      params: {
        search: params.search || undefined,
        type: params.type || undefined,
        organization_uuid: params.organization_uuid || undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
        per_page: params.per_page ?? 30,
        page: params.page ?? 1,
      },
    });
    return response.data;
  },

  getByUuid: async (uuid: string): Promise<SpaceResponse> => {
    const response = await apiClient.get<SpaceResponse>(`/spaces/${uuid}`);
    return response.data;
  },

  create: async (payload: CreateSpacePayload): Promise<SpaceResponse> => {
    const response = await apiClient.post<SpaceResponse>('/spaces', payload);
    return response.data;
  },

  update: async (
    uuid: string,
    payload: UpdateSpacePayload
  ): Promise<SpaceResponse> => {
    const response = await apiClient.put<SpaceResponse>(
      `/spaces/${uuid}`,
      payload
    );
    return response.data;
  },

  remove: async (uuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/spaces/${uuid}`);
    return response.data;
  },

  getChannels: async (
    spaceUuid: string,
    params: ChannelListParams = {}
  ): Promise<ChannelListResponse> => {
    const response = await apiClient.get<ChannelListResponse>(
      `/spaces/${spaceUuid}/channels`,
      {
        params: {
          search: params.search || undefined,
          visibility: params.visibility || undefined,
          sort: params.sort || undefined,
          order: params.order || undefined,
          per_page: params.per_page ?? 50,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  getMembers: async (
    uuid: string,
    params: MemberListParams = {}
  ): Promise<SpaceMemberListResponse> => {
    const response = await apiClient.get<SpaceMemberListResponse>(
      `/spaces/${uuid}/members`,
      {
        params: {
          search: params.search || undefined,
          per_page: params.per_page ?? 100,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  invite: async (
    uuid: string,
    payload: InviteMemberPayload
  ): Promise<MemberResponse> => {
    const response = await apiClient.post<MemberResponse>(
      `/spaces/${uuid}/members`,
      payload
    );
    return response.data;
  },

  updateMemberRole: async (
    uuid: string,
    userUuid: string,
    payload: UpdateMemberRolePayload
  ): Promise<MemberResponse> => {
    const response = await apiClient.put<MemberResponse>(
      `/spaces/${uuid}/members/${userUuid}`,
      payload
    );
    return response.data;
  },

  removeMember: async (
    uuid: string,
    userUuid: string
  ): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/spaces/${uuid}/members/${userUuid}`
    );
    return response.data;
  },

  leave: async (uuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      `/spaces/${uuid}/leave`,
      {}
    );
    return response.data;
  },

  transferOwnership: async (
    uuid: string,
    payload: TransferOwnershipPayload
  ): Promise<MemberResponse> => {
    const response = await apiClient.post<MemberResponse>(
      `/spaces/${uuid}/transfer-ownership`,
      payload
    );
    return response.data;
  },
};

/** Channels are bound by uuid at the top level (matches `/channels/{uuid}`). */
export const channelsApi = {
  /**
   * The caller's active-membership channels across ALL their spaces
   * (`GET /channels`), sorted `last_message_at` desc (empty channels last),
   * muted excluded unless `mention_count > 0`. Each row carries the per-space
   * channel payload PLUS a `last_message` preview (see `types/collab.ts`) and its
   * `space` context. This is the ONLY route that stamps `last_message`; supports
   * `search` + `per_page` (server-controlled sort — visibility/sort/order ignored).
   */
  getMine: async (
    params: ChannelListParams = {}
  ): Promise<ChannelListResponse> => {
    const response = await apiClient.get<ChannelListResponse>('/channels', {
      params: {
        search: params.search || undefined,
        per_page: params.per_page ?? 20,
        page: params.page ?? 1,
      },
    });
    return response.data;
  },

  getByUuid: async (uuid: string): Promise<ChannelResponse> => {
    const response = await apiClient.get<ChannelResponse>(`/channels/${uuid}`);
    return response.data;
  },

  create: async (
    spaceUuid: string,
    payload: CreateChannelPayload
  ): Promise<ChannelResponse> => {
    const response = await apiClient.post<ChannelResponse>(
      `/spaces/${spaceUuid}/channels`,
      payload
    );
    return response.data;
  },

  update: async (
    uuid: string,
    payload: UpdateChannelPayload
  ): Promise<ChannelResponse> => {
    const response = await apiClient.put<ChannelResponse>(
      `/channels/${uuid}`,
      payload
    );
    return response.data;
  },

  remove: async (uuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/channels/${uuid}`
    );
    return response.data;
  },

  getMembers: async (
    uuid: string,
    params: MemberListParams = {}
  ): Promise<ChannelMemberListResponse> => {
    const response = await apiClient.get<ChannelMemberListResponse>(
      `/channels/${uuid}/members`,
      {
        params: {
          search: params.search || undefined,
          per_page: params.per_page ?? 100,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  invite: async (
    uuid: string,
    payload: InviteMemberPayload
  ): Promise<MemberResponse> => {
    const response = await apiClient.post<MemberResponse>(
      `/channels/${uuid}/members`,
      payload
    );
    return response.data;
  },

  updateMemberRole: async (
    uuid: string,
    userUuid: string,
    payload: UpdateMemberRolePayload
  ): Promise<MemberResponse> => {
    const response = await apiClient.put<MemberResponse>(
      `/channels/${uuid}/members/${userUuid}`,
      payload
    );
    return response.data;
  },

  removeMember: async (
    uuid: string,
    userUuid: string
  ): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/channels/${uuid}/members/${userUuid}`
    );
    return response.data;
  },

  /** Self-only notify level (`all | mentions_only | muted`). */
  setNotifyLevel: async (
    uuid: string,
    payload: NotifyLevelPayload
  ): Promise<MemberResponse> => {
    const response = await apiClient.patch<MemberResponse>(
      `/channels/${uuid}/members/me`,
      payload
    );
    return response.data;
  },

  join: async (uuid: string): Promise<MemberResponse> => {
    const response = await apiClient.post<MemberResponse>(
      `/channels/${uuid}/join`,
      {}
    );
    return response.data;
  },

  leave: async (uuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      `/channels/${uuid}/leave`,
      {}
    );
    return response.data;
  },

  /**
   * Start a thread in this channel — the CHANNEL is the collection, not the
   * message, because a thread can be started with no message at all.
   *
   * IT RETURNS A CHANNEL, and a thread IS a channel: `/channels/{uuid}` is its
   * address and every channel endpoint takes its uuid. `201` created it, `200`
   * means this message already had one and that is the SAME OUTCOME to the
   * person who pressed — both mean "you are in the thread for this message" —
   * so callers must not tell them apart (measured on prod 2026-08-12: the same
   * uuid comes back, with the message "This message already has a thread.").
   *
   * `422` is the real refusal, and it is a sentence worth showing: the branched
   * message was not found in this channel (missing, foreign or deleted are
   * folded into ONE answer so the endpoint is not an existence oracle), or the
   * channel is itself a thread (branching is one level deep).
   */
  createThread: async (
    uuid: string,
    payload: CreateThreadPayload
  ): Promise<ChannelResponse> => {
    const response = await apiClient.post<ChannelResponse>(
      `/channels/${uuid}/threads`,
      payload
    );
    return response.data;
  },

  /** Advance the caller's read pointer; monotonic (backward marks are no-ops). */
  markRead: async (
    uuid: string,
    messageUuid: string
  ): Promise<MarkReadResponse> => {
    const response = await apiClient.post<MarkReadResponse>(
      `/channels/${uuid}/read`,
      { message_uuid: messageUuid }
    );
    return response.data;
  },
};

/** Organizations — profile, membership and verification. */
export const organizationsApi = {
  /** The caller's current organization, or `data: null` if they have none. */
  myOrganization: async (): Promise<MyOrganizationResponse> => {
    const response =
      await apiClient.get<MyOrganizationResponse>('/my-organization');
    return response.data;
  },

  getByUuid: async (uuid: string): Promise<OrganizationResponse> => {
    const response = await apiClient.get<OrganizationResponse>(
      `/organizations/${uuid}`
    );
    return response.data;
  },

  create: async (
    payload: CreateOrganizationPayload
  ): Promise<OrganizationResponse> => {
    const response = await apiClient.post<OrganizationResponse>(
      '/organizations',
      payload
    );
    return response.data;
  },

  update: async (
    uuid: string,
    payload: UpdateOrganizationPayload
  ): Promise<OrganizationResponse> => {
    const response = await apiClient.put<OrganizationResponse>(
      `/organizations/${uuid}`,
      payload
    );
    return response.data;
  },

  remove: async (uuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/organizations/${uuid}`
    );
    return response.data;
  },

  getMembers: async (
    uuid: string,
    params: MemberListParams = {}
  ): Promise<OrganizationMemberListResponse> => {
    const response = await apiClient.get<OrganizationMemberListResponse>(
      `/organizations/${uuid}/members`,
      {
        params: {
          search: params.search || undefined,
          per_page: params.per_page ?? 100,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  invite: async (
    uuid: string,
    payload: InviteMemberPayload
  ): Promise<MemberResponse> => {
    const response = await apiClient.post<MemberResponse>(
      `/organizations/${uuid}/members`,
      payload
    );
    return response.data;
  },

  updateMemberRole: async (
    uuid: string,
    userUuid: string,
    payload: UpdateMemberRolePayload
  ): Promise<MemberResponse> => {
    const response = await apiClient.put<MemberResponse>(
      `/organizations/${uuid}/members/${userUuid}`,
      payload
    );
    return response.data;
  },

  removeMember: async (
    uuid: string,
    userUuid: string
  ): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/organizations/${uuid}/members/${userUuid}`
    );
    return response.data;
  },

  leaveMyOrganization: async (): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      '/my-organization/leave',
      {}
    );
    return response.data;
  },

  /** Submit CAC verification (multipart: bn_number + cac_document file). */
  requestVerification: async (
    uuid: string,
    payload: RequestVerificationPayload
  ): Promise<OrganizationResponse> => {
    const formData = new FormData();
    formData.append('bn_number', payload.bn_number);
    formData.append('cac_document', payload.cac_document);
    const response = await apiClient.post<OrganizationResponse>(
      `/organizations/${uuid}/request-verification`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },
};

/** Invitation inboxes — the invitee's perspective (accept / decline / reject). */
export const invitationsApi = {
  channels: {
    list: async (params: PageParams = {}): Promise<ChannelInvitationListResponse> => {
      const response = await apiClient.get<ChannelInvitationListResponse>(
        '/channel-invitations',
        { params: { per_page: params.per_page ?? 50, page: params.page ?? 1 } }
      );
      return response.data;
    },
    accept: async (id: number): Promise<MemberResponse> => {
      const response = await apiClient.post<MemberResponse>(
        `/channel-invitations/${id}/accept`,
        {}
      );
      return response.data;
    },
    decline: async (id: number): Promise<ApiResponse<null>> => {
      const response = await apiClient.post<ApiResponse<null>>(
        `/channel-invitations/${id}/decline`,
        {}
      );
      return response.data;
    },
  },

  spaces: {
    list: async (params: PageParams = {}): Promise<SpaceInvitationListResponse> => {
      const response = await apiClient.get<SpaceInvitationListResponse>(
        '/space-invitations',
        { params: { per_page: params.per_page ?? 50, page: params.page ?? 1 } }
      );
      return response.data;
    },
    accept: async (id: number): Promise<MemberResponse> => {
      const response = await apiClient.post<MemberResponse>(
        `/space-invitations/${id}/accept`,
        {}
      );
      return response.data;
    },
    decline: async (id: number): Promise<ApiResponse<null>> => {
      const response = await apiClient.post<ApiResponse<null>>(
        `/space-invitations/${id}/decline`,
        {}
      );
      return response.data;
    },
  },

  organizations: {
    list: async (
      params: PageParams = {}
    ): Promise<OrganizationInvitationListResponse> => {
      const response = await apiClient.get<OrganizationInvitationListResponse>(
        '/organization-invitations',
        { params: { per_page: params.per_page ?? 50, page: params.page ?? 1 } }
      );
      return response.data;
    },
    accept: async (id: number): Promise<MemberResponse> => {
      const response = await apiClient.post<MemberResponse>(
        `/organization-invitations/${id}/accept`,
        {}
      );
      return response.data;
    },
    reject: async (id: number): Promise<ApiResponse<null>> => {
      const response = await apiClient.post<ApiResponse<null>>(
        `/organization-invitations/${id}/reject`,
        {}
      );
      return response.data;
    },
  },
};

/** Channel messages — cursor paginated, newest-first. */
export const messagesApi = {
  /**
   * One message's replies, oldest first — the conversation hanging off it.
   *
   * PAGE-BASED, not the cursor the feed uses. Do not copy the feed's paging
   * code onto it; they are different shapes and measured as such.
   */
  replies: async (
    channelUuid: string,
    messageUuid: string,
    page = 1
  ): Promise<MessageRepliesResponse> => {
    const response = await apiClient.get<MessageRepliesResponse>(
      `/channels/${channelUuid}/messages/${messageUuid}/replies`,
      { params: { page } }
    );
    return response.data;
  },

  list: async (
    channelUuid: string,
    params: MessageListParams = {}
  ): Promise<MessageListResponse> => {
    const response = await apiClient.get<MessageListResponse>(
      `/channels/${channelUuid}/messages`,
      {
        params: {
          per_page: params.per_page ?? 30,
          cursor: params.cursor || undefined,
        },
      }
    );
    return response.data;
  },

  send: async (
    channelUuid: string,
    payload: SendMessagePayload
  ): Promise<SendMessageResponse> => {
    const response = await apiClient.post<SendMessageResponse>(
      `/channels/${channelUuid}/messages`,
      payload
    );
    return response.data;
  },

  update: async (
    channelUuid: string,
    messageUuid: string,
    payload: UpdateMessagePayload
  ): Promise<MessageResponse> => {
    const response = await apiClient.patch<MessageResponse>(
      `/channels/${channelUuid}/messages/${messageUuid}`,
      payload
    );
    return response.data;
  },

  remove: async (
    channelUuid: string,
    messageUuid: string
  ): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/channels/${channelUuid}/messages/${messageUuid}`
    );
    return response.data;
  },
};

/**
 * Message engagement — reactions, pins and private saves (backend phases
 * 3d/3e/3f). Every route gates on active channel membership.
 *
 * Three toggles and three lists, with three different politics:
 *  - REACTIONS are shared and broadcast as deltas (`.reaction.toggled`); the
 *    toggle answers `200` both ways with the emoji bucket's new state. **60/min.**
 *  - PINS are shared: ANY active member may pin AND unpin anyone's pin
 *    (first-pinner-wins, idempotent). The list adds `pinned_by` + `pinned_at`.
 *  - BOOKMARKS ("saves") are PRIVATE and never broadcast — REST is the only
 *    transport, so the toggle response and the list are the whole truth. **60/min.**
 */
export const messageEngagementApi = {
  /** Toggle one emoji on a message (`200` both ways). 429 = throttled. */
  toggleReaction: async (
    channelUuid: string,
    messageUuid: string,
    payload: ToggleReactionPayload
  ): Promise<ReactionToggleResponse> => {
    const response = await apiClient.post<ReactionToggleResponse>(
      `/channels/${channelUuid}/messages/${messageUuid}/reactions`,
      payload
    );
    return response.data;
  },

  /** Pin a message for everyone (`201`; already pinned is a no-op `200`). */
  pin: async (
    channelUuid: string,
    messageUuid: string
  ): Promise<PinToggleResponse> => {
    const response = await apiClient.post<PinToggleResponse>(
      `/channels/${channelUuid}/messages/${messageUuid}/pin`,
      {}
    );
    return response.data;
  },

  /** Unpin — permitted to any active member, not just the pinner. */
  unpin: async (
    channelUuid: string,
    messageUuid: string
  ): Promise<PinToggleResponse> => {
    const response = await apiClient.delete<PinToggleResponse>(
      `/channels/${channelUuid}/messages/${messageUuid}/pin`
    );
    return response.data;
  },

  /** The channel's pinned messages, `pinned_at DESC`. */
  getPins: async (
    channelUuid: string,
    params: { per_page?: number; page?: number } = {}
  ): Promise<PinnedMessageListResponse> => {
    const response = await apiClient.get<PinnedMessageListResponse>(
      `/channels/${channelUuid}/messages/pins`,
      {
        params: { per_page: params.per_page ?? 30, page: params.page ?? 1 },
      }
    );
    return response.data;
  },

  /** Toggle the caller's private save (`201` added / `200` removed). */
  toggleBookmark: async (
    channelUuid: string,
    messageUuid: string
  ): Promise<BookmarkToggleResponse> => {
    const response = await apiClient.post<BookmarkToggleResponse>(
      `/channels/${channelUuid}/messages/${messageUuid}/bookmark`,
      {}
    );
    return response.data;
  },

  /** The caller's saved messages in this channel — private, offset-paginated. */
  getBookmarks: async (
    channelUuid: string,
    params: { per_page?: number; page?: number } = {}
  ): Promise<SavedMessageListResponse> => {
    const response = await apiClient.get<SavedMessageListResponse>(
      `/channels/${channelUuid}/messages/bookmarks`,
      {
        params: { per_page: params.per_page ?? 30, page: params.page ?? 1 },
      }
    );
    return response.data;
  },
};

/** Shared channel AI (Lawexa) — session control + history. All gate on membership. */
export const channelAiApi = {
  /** Close the active AI session and post an `ai_divider`. Idempotent (200 always). */
  reset: async (channelUuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      `/channels/${channelUuid}/ai/reset`,
      {}
    );
    return response.data;
  },

  /** Length-aware list of a channel's AI sessions, newest-first. */
  getSessions: async (
    channelUuid: string,
    params: { per_page?: number; page?: number } = {}
  ): Promise<AiSessionListResponse> => {
    const response = await apiClient.get<AiSessionListResponse>(
      `/channels/${channelUuid}/ai/sessions`,
      {
        params: {
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  /** Cursor-paginated transcript of one AI session (404 if not in this channel). */
  getSession: async (
    channelUuid: string,
    sessionUuid: string,
    params: { per_page?: number; cursor?: string } = {}
  ): Promise<AiSessionTranscriptResponse> => {
    const response = await apiClient.get<AiSessionTranscriptResponse>(
      `/channels/${channelUuid}/ai/sessions/${sessionUuid}`,
      {
        params: {
          per_page: params.per_page ?? 30,
          cursor: params.cursor || undefined,
        },
      }
    );
    return response.data;
  },
};

/**
 * Channel task lists — member-only content (space governors / platform admins
 * get `403` on reads, Slack-style). Lists and their items are addressed by
 * `uuid`. The index returns counts (`TaskListSummary`); show / create / update
 * return the full `items` array (`TaskList`).
 */
export const channelListsApi = {
  getList: async (
    channelUuid: string,
    params: { per_page?: number; page?: number } = {}
  ): Promise<TaskListSummaryListResponse> => {
    const response = await apiClient.get<TaskListSummaryListResponse>(
      `/channels/${channelUuid}/lists`,
      {
        params: {
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  create: async (
    channelUuid: string,
    payload: CreateListPayload
  ): Promise<TaskListResponse> => {
    const response = await apiClient.post<TaskListResponse>(
      `/channels/${channelUuid}/lists`,
      payload
    );
    return response.data;
  },

  show: async (listUuid: string): Promise<TaskListResponse> => {
    const response = await apiClient.get<TaskListResponse>(`/lists/${listUuid}`);
    return response.data;
  },

  update: async (
    listUuid: string,
    payload: UpdateListPayload
  ): Promise<TaskListResponse> => {
    const response = await apiClient.put<TaskListResponse>(
      `/lists/${listUuid}`,
      payload
    );
    return response.data;
  },

  remove: async (listUuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/lists/${listUuid}`
    );
    return response.data;
  },

  addItem: async (
    listUuid: string,
    payload: AddListItemPayload
  ): Promise<TaskListItemResponse> => {
    const response = await apiClient.post<TaskListItemResponse>(
      `/lists/${listUuid}/items`,
      payload
    );
    return response.data;
  },

  updateItem: async (
    listUuid: string,
    itemUuid: string,
    payload: UpdateListItemPayload
  ): Promise<TaskListItemResponse> => {
    const response = await apiClient.patch<TaskListItemResponse>(
      `/lists/${listUuid}/items/${itemUuid}`,
      payload
    );
    return response.data;
  },

  removeItem: async (
    listUuid: string,
    itemUuid: string
  ): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/lists/${listUuid}/items/${itemUuid}`
    );
    return response.data;
  },

  /** Send the FULL ordered uuid set; positions are rewritten `0..n-1`. */
  reorderItems: async (
    listUuid: string,
    payload: ReorderListItemsPayload
  ): Promise<TaskListItemsResponse> => {
    const response = await apiClient.post<TaskListItemsResponse>(
      `/lists/${listUuid}/items/reorder`,
      payload
    );
    return response.data;
  },
};

/**
 * Channel file library — member-only content (space governors / platform admins
 * get `403` on reads, same privacy rule as lists). Files are addressed by
 * integer `id`, not uuid. Reuse `filesApi.getDownloadUrl(id)` for downloads.
 */
export const channelFilesApi = {
  getList: async (
    channelUuid: string,
    params: { per_page?: number; page?: number } = {}
  ): Promise<ChannelFileListResponse> => {
    const response = await apiClient.get<ChannelFileListResponse>(
      `/channels/${channelUuid}/files`,
      {
        params: {
          per_page: params.per_page ?? 30,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  /**
   * Upload a single file (multipart, field `file`, max 15 MB).
   *
   * `options` is OPTIONAL and additive — existing callers are unchanged:
   *  - `onProgress(sent, total)` reports BYTES PUT ON THE WIRE, which is not
   *    the same thing as "done". When `sent === total` the server is still
   *    storing and sniffing the file, so a caller must not paint 100 % as
   *    completion; wait for the promise.
   *  - `signal` aborts the request (the upload tray's Cancel). An aborted
   *    request rejects like any other failure — the caller decides whether it
   *    was a cancellation, by remembering that it asked for one.
   */
  upload: async (
    channelUuid: string,
    file: File,
    options: {
      onProgress?: (sent: number, total: number) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<ChannelFileResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<ChannelFileResponse>(
      `/channels/${channelUuid}/files`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: options.signal,
        onUploadProgress: options.onProgress
          ? (event) => {
              // `event.total` is absent on some transports; the file's own
              // size is the honest denominator and never lies.
              options.onProgress?.(event.loaded, event.total ?? file.size);
            }
          : undefined,
      }
    );
    return response.data;
  },

  remove: async (
    channelUuid: string,
    id: number
  ): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/channels/${channelUuid}/files/${id}`
    );
    return response.data;
  },
};

/**
 * Invite links, the two waiting lists, and browsing public spaces.
 * API commit `36a2c54`, 2026-08-10 — `docs/api/spaces-channels-invite-links.md`.
 */
export const inviteLinksApi = {
  /**
   * THE ONE ROUTE THAT MUST WORK WITHOUT A TOKEN. It renders the "you have been
   * invited" screen for somebody who has no account yet, so it deliberately
   * carries no `Authorization` requirement.
   *
   * It still goes through `apiClient`: a token is SENT when one exists, and it
   * has to be, because `viewer_action` is the server's answer about THIS
   * viewer. Stripping the token here would tell a signed-in member they need
   * to sign up.
   *
   * `404` (no such code) and `410` (revoked, expired or used up) are different
   * on purpose, so somebody whose invite quietly lapsed is told why rather than
   * that it never existed.
   */
  preview: async (code: string): Promise<InvitePreviewResponse> => {
    const response = await apiClient.get<InvitePreviewResponse>(
      `/invite-links/${code}`
    );
    return response.data;
  },

  /** Previewing never counts as a use — only this does. */
  accept: async (code: string): Promise<InviteAcceptResponse> => {
    const response = await apiClient.post<InviteAcceptResponse>(
      `/invite-links/${code}/accept`,
      {}
    );
    return response.data;
  },

  list: async (spaceUuid: string): Promise<InviteLinkListResponse> => {
    const response = await apiClient.get<InviteLinkListResponse>(
      `/spaces/${spaceUuid}/invite-links`
    );
    return response.data;
  },

  create: async (
    spaceUuid: string,
    payload: CreateInviteLinkPayload = {}
  ): Promise<InviteLinkResponse> => {
    const response = await apiClient.post<InviteLinkResponse>(
      `/spaces/${spaceUuid}/invite-links`,
      payload
    );
    return response.data;
  },

  /** Revoke. The row is kept, never deleted, so its use count survives. */
  revoke: async (id: number): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/invite-links/${id}`
    );
    return response.data;
  },
};

/**
 * The waiting lists. Two queues, one shape.
 *
 * EVERY `id` HERE IS READ OFF THE ROW, never built. The API shipped once with
 * that field missing and thirty passing tests did not catch it, because a test
 * keeps the id it created while an app has to read it back.
 */
export const joinRequestsApi = {
  listForSpace: async (spaceUuid: string): Promise<JoinRequestListResponse> => {
    const response = await apiClient.get<JoinRequestListResponse>(
      `/spaces/${spaceUuid}/join-requests`
    );
    return response.data;
  },

  approveSpace: async (id: number): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      `/space-join-requests/${id}/approve`,
      {}
    );
    return response.data;
  },

  rejectSpace: async (id: number): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      `/space-join-requests/${id}/reject`,
      {}
    );
    return response.data;
  },

  listForChannel: async (
    channelUuid: string
  ): Promise<JoinRequestListResponse> => {
    const response = await apiClient.get<JoinRequestListResponse>(
      `/channels/${channelUuid}/join-requests`
    );
    return response.data;
  },

  /**
   * Ask to be let into a private channel.
   *
   * `201` created, `200` you already had one waiting — BOTH are successes and
   * neither may draw an error. `404` is a hidden channel and must be shown as
   * "no such channel": anything softer confirms it exists. `409` means the
   * channel is open and should simply be joined.
   */
  requestChannel: async (channelUuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      `/channels/${channelUuid}/join-requests`,
      {}
    );
    return response.data;
  },

  approveChannel: async (id: number): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      `/channel-join-requests/${id}/approve`,
      {}
    );
    return response.data;
  },

  rejectChannel: async (id: number): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      `/channel-join-requests/${id}/reject`,
      {}
    );
    return response.data;
  },
};

/** Browsing and joining public spaces. */
export const discoverApi = {
  spaces: async (
    params: DiscoverSpacesParams = {}
  ): Promise<DiscoverSpacesResponse> => {
    const response = await apiClient.get<DiscoverSpacesResponse>(
      '/spaces/discover',
      {
        params: {
          search: params.search || undefined,
          per_page: params.per_page ?? 20,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  /** Self-join a public space. `403` for a guest, or for a private space. */
  join: async (spaceUuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.post<ApiResponse<null>>(
      `/spaces/${spaceUuid}/join`,
      {}
    );
    return response.data;
  },
};
