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
  AiSessionListResponse,
  AiSessionTranscriptResponse,
  ChannelInvitationListResponse,
  ChannelListParams,
  ChannelListResponse,
  ChannelMemberListResponse,
  ChannelResponse,
  CreateChannelPayload,
  CreateOrganizationPayload,
  CreateSpacePayload,
  InviteMemberPayload,
  MarkReadResponse,
  MemberListParams,
  MemberResponse,
  MessageListParams,
  MessageListResponse,
  MessageResponse,
  MyOrganizationResponse,
  NotifyLevelPayload,
  OrganizationInvitationListResponse,
  OrganizationMemberListResponse,
  OrganizationResponse,
  RequestVerificationPayload,
  SendMessagePayload,
  SendMessageResponse,
  SpaceInvitationListResponse,
  SpaceListParams,
  SpaceListResponse,
  SpaceMemberListResponse,
  SpaceResponse,
  TransferOwnershipPayload,
  UpdateChannelPayload,
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
