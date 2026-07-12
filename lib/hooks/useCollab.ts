'use client';

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import {
  channelsApi,
  invitationsApi,
  messagesApi,
  organizationsApi,
  spacesApi,
} from '@/lib/api/collab';
import { useAuthStore } from '@/lib/stores/authStore';
import type {
  ChannelListParams,
  ChannelListResponse,
  ChannelResponse,
  CreateChannelPayload,
  CreateOrganizationPayload,
  CreateSpacePayload,
  InviteMemberPayload,
  MemberListParams,
  Message,
  MessageListParams,
  MessageListResponse,
  NotifyLevelPayload,
  RequestVerificationPayload,
  SendMessagePayload,
  SlimUser,
  SpaceListParams,
  SpaceResponse,
  TransferOwnershipPayload,
  UpdateChannelPayload,
  UpdateMemberRolePayload,
  UpdateOrganizationPayload,
  UpdateSpacePayload,
} from '@/types/collab';

/******************************************************************************
                              Query keys
******************************************************************************/

export const collabKeys = {
  all: ['collab'] as const,
  myOrganization: ['collab', 'my-organization'] as const,
  spaces: {
    all: ['collab', 'spaces'] as const,
    listPrefix: ['collab', 'spaces', 'list'] as const,
    list: (params: SpaceListParams) =>
      ['collab', 'spaces', 'list', params] as const,
    detail: (uuid: string) => ['collab', 'spaces', 'detail', uuid] as const,
    channelsPrefix: (spaceUuid: string) =>
      ['collab', 'spaces', spaceUuid, 'channels'] as const,
    channels: (spaceUuid: string, params: ChannelListParams) =>
      ['collab', 'spaces', spaceUuid, 'channels', params] as const,
    membersPrefix: (spaceUuid: string) =>
      ['collab', 'spaces', spaceUuid, 'members'] as const,
    members: (spaceUuid: string, params: MemberListParams) =>
      ['collab', 'spaces', spaceUuid, 'members', params] as const,
  },
  channels: {
    detail: (uuid: string) => ['collab', 'channels', 'detail', uuid] as const,
    membersPrefix: (uuid: string) =>
      ['collab', 'channels', uuid, 'members'] as const,
    members: (uuid: string, params: MemberListParams) =>
      ['collab', 'channels', uuid, 'members', params] as const,
    messagesPrefix: (channelUuid: string) =>
      ['collab', 'channels', channelUuid, 'messages'] as const,
    messages: (channelUuid: string, params: MessageListParams) =>
      ['collab', 'channels', channelUuid, 'messages', params] as const,
  },
  invitations: {
    channels: ['collab', 'invitations', 'channels'] as const,
    spaces: ['collab', 'invitations', 'spaces'] as const,
    organizations: ['collab', 'invitations', 'organizations'] as const,
  },
  organizations: {
    detail: (uuid: string) =>
      ['collab', 'organizations', 'detail', uuid] as const,
    membersPrefix: (uuid: string) =>
      ['collab', 'organizations', uuid, 'members'] as const,
    members: (uuid: string, params: MemberListParams) =>
      ['collab', 'organizations', uuid, 'members', params] as const,
  },
} as const;

/**
 * Channels are behind auth + email verification and are never guest-readable,
 * so gate every query the same way the radar hooks do.
 */
function useIsCollabEnabled(): boolean {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isGuest = useAuthStore((s) => s.isGuest);
  return isAuthenticated && !isGuest;
}

/******************************************************************************
                              Spaces
******************************************************************************/

/** The caller's spaces (each list item stamps `my_role`). */
export function useSpaces(params: SpaceListParams = {}) {
  const enabled = useIsCollabEnabled();

  return useQuery({
    queryKey: collabKeys.spaces.list(params),
    queryFn: () => spacesApi.getList(params),
    enabled,
    staleTime: 30 * 1000,
  });
}

/** Full space detail (roster + creator). */
export function useSpace(uuid: string) {
  const enabled = useIsCollabEnabled();

  return useQuery({
    queryKey: collabKeys.spaces.detail(uuid),
    queryFn: () => spacesApi.getByUuid(uuid),
    enabled: enabled && !!uuid,
    staleTime: 30 * 1000,
  });
}

/**
 * Channels within a space. A space member who is not a channel member only
 * sees `space_public` channels here (private channels are hidden by the server).
 */
export function useSpaceChannels(
  spaceUuid: string,
  params: ChannelListParams = {}
) {
  const enabled = useIsCollabEnabled();

  return useQuery({
    queryKey: collabKeys.spaces.channels(spaceUuid, params),
    queryFn: () => spacesApi.getChannels(spaceUuid, params),
    enabled: enabled && !!spaceUuid,
    staleTime: 30 * 1000,
  });
}

/******************************************************************************
                              Channels & messages
******************************************************************************/

/** Full channel detail (settings + unread_count for members). */
export function useChannel(uuid: string) {
  const enabled = useIsCollabEnabled();

  return useQuery({
    queryKey: collabKeys.channels.detail(uuid),
    queryFn: () => channelsApi.getByUuid(uuid),
    enabled: enabled && !!uuid,
    staleTime: 30 * 1000,
  });
}

/**
 * Message history for a channel. Cursor-paginated and newest-first, so each
 * `fetchNextPage()` loads an OLDER page. Stop is signalled by a null
 * `next_cursor` (`getNextPageParam` returns undefined). Render the flattened
 * pages reversed to get chronological (oldest → newest) order.
 */
export function useChannelMessages(
  channelUuid: string,
  params: Omit<MessageListParams, 'cursor'> = {}
) {
  const enabled = useIsCollabEnabled();

  return useInfiniteQuery({
    queryKey: collabKeys.channels.messages(channelUuid, params),
    queryFn: ({ pageParam }) =>
      messagesApi.list(channelUuid, {
        ...params,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
    enabled: enabled && !!channelUuid,
    staleTime: 15 * 1000,
  });
}

/** Active + pending members of a channel (drives mention autocomplete). */
export function useChannelMembers(
  channelUuid: string,
  params: MemberListParams = {},
  options: { enabled?: boolean } = {}
) {
  const enabled = useIsCollabEnabled();

  return useQuery({
    queryKey: collabKeys.channels.members(channelUuid, params),
    queryFn: () => channelsApi.getMembers(channelUuid, params),
    enabled: enabled && !!channelUuid && (options.enabled ?? true),
    staleTime: 60 * 1000,
  });
}

/******************************************************************************
                              Current user
******************************************************************************/

/** The signed-in user's uuid, or null before it is known. */
export function useCurrentUserUuid(): string | null {
  return useAuthStore((s) => s.user?.uuid ?? null);
}

/******************************************************************************
                              Message mutations
******************************************************************************/

type MessagePages = InfiniteData<MessageListResponse>;
type MessageSnapshot = [readonly unknown[], MessagePages | undefined];

/** Rewrite every cached message page for a channel through `map`. */
function patchMessagePages(
  snapshots: MessageSnapshot[],
  map: (message: Message) => Message | null
): { queryKey: readonly unknown[]; data: MessagePages }[] {
  const next: { queryKey: readonly unknown[]; data: MessagePages }[] = [];
  for (const [queryKey, data] of snapshots) {
    if (!data) continue;
    next.push({
      queryKey,
      data: {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          data: page.data
            .map((message) => map(message))
            .filter((message): message is Message => message !== null),
        })),
      },
    });
  }
  return next;
}

let optimisticCounter = 0;

/** Post a message with an optimistic bubble that reconciles on success. */
export function useSendMessage(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SendMessagePayload) =>
      messagesApi.send(channelUuid, payload),

    onMutate: async (payload) => {
      const key = collabKeys.channels.messagesPrefix(channelUuid);
      await queryClient.cancelQueries({ queryKey: key });

      // Read the author at mutation time — never build an object in a store
      // selector during render (that loops via useSyncExternalStore).
      const me = useAuthStore.getState().user;
      const author: SlimUser | null = me
        ? { uuid: me.uuid ?? '', name: me.name, avatar_url: me.avatar_url }
        : null;

      const tempUuid = `optimistic-${(optimisticCounter += 1)}`;
      const optimistic: Message = {
        uuid: tempUuid,
        channel_uuid: channelUuid,
        author,
        content: payload.content,
        metadata: {
          mentions: [],
          lawexa_mentioned: /(^|\s)@lawexa\b/i.test(payload.content),
        },
        parent_message_uuid: payload.parent_message_uuid ?? null,
        edited_at: null,
        created_at: new Date().toISOString(),
      };

      const snapshots = queryClient.getQueriesData<MessagePages>({ queryKey: key });
      for (const [qKey, data] of snapshots) {
        if (!data || data.pages.length === 0) continue;
        const [first, ...rest] = data.pages;
        // Messages are newest-first, so a brand-new message leads the first page.
        queryClient.setQueryData<MessagePages>(qKey, {
          ...data,
          pages: [{ ...first, data: [optimistic, ...first.data] }, ...rest],
        });
      }
      return { snapshots, tempUuid };
    },

    onError: (_error, _payload, context) => {
      for (const [qKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(qKey, data);
      }
    },

    onSuccess: (response, _payload, context) => {
      const server = response.data;
      const snapshots = queryClient.getQueriesData<MessagePages>({
        queryKey: collabKeys.channels.messagesPrefix(channelUuid),
      });
      for (const { queryKey, data } of patchMessagePages(snapshots, (message) =>
        message.uuid === context?.tempUuid ? server : message
      )) {
        queryClient.setQueryData(queryKey, data);
      }
    },
  });
}

interface EditMessageVariables {
  messageUuid: string;
  content: string;
}

/** Edit an authored message; content + edited_at update optimistically. */
export function useUpdateMessage(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageUuid, content }: EditMessageVariables) =>
      messagesApi.update(channelUuid, messageUuid, { content }),

    onMutate: async ({ messageUuid, content }) => {
      const key = collabKeys.channels.messagesPrefix(channelUuid);
      await queryClient.cancelQueries({ queryKey: key });
      const snapshots = queryClient.getQueriesData<MessagePages>({ queryKey: key });
      const editedAt = new Date().toISOString();
      for (const { queryKey, data } of patchMessagePages(snapshots, (message) =>
        message.uuid === messageUuid
          ? { ...message, content, edited_at: editedAt }
          : message
      )) {
        queryClient.setQueryData(queryKey, data);
      }
      return { snapshots };
    },

    onError: (_error, _vars, context) => {
      for (const [qKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(qKey, data);
      }
    },

    onSuccess: (response) => {
      const server = response.data;
      const snapshots = queryClient.getQueriesData<MessagePages>({
        queryKey: collabKeys.channels.messagesPrefix(channelUuid),
      });
      for (const { queryKey, data } of patchMessagePages(snapshots, (message) =>
        message.uuid === server.uuid ? server : message
      )) {
        queryClient.setQueryData(queryKey, data);
      }
    },
  });
}

/** Delete a message; it drops from history immediately (soft delete). */
export function useDeleteMessage(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageUuid: string) =>
      messagesApi.remove(channelUuid, messageUuid),

    onMutate: async (messageUuid) => {
      const key = collabKeys.channels.messagesPrefix(channelUuid);
      await queryClient.cancelQueries({ queryKey: key });
      const snapshots = queryClient.getQueriesData<MessagePages>({ queryKey: key });
      for (const { queryKey, data } of patchMessagePages(snapshots, (message) =>
        message.uuid === messageUuid ? null : message
      )) {
        queryClient.setQueryData(queryKey, data);
      }
      return { snapshots };
    },

    onError: (_error, _messageUuid, context) => {
      for (const [qKey, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(qKey, data);
      }
    },
  });
}

/**
 * Advance the caller's read pointer to a message and sync the resulting
 * unread_count onto the channel detail and its rows in the space channel list.
 */
export function useMarkChannelRead(channelUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageUuid: string) =>
      channelsApi.markRead(channelUuid, messageUuid),

    onSuccess: (response) => {
      const unread = response.data.unread_count;

      queryClient.setQueryData<ChannelResponse>(
        collabKeys.channels.detail(channelUuid),
        (old) =>
          old ? { ...old, data: { ...old.data, unread_count: unread } } : old
      );

      const detail = queryClient.getQueryData<ChannelResponse>(
        collabKeys.channels.detail(channelUuid)
      );
      const spaceUuid = detail?.data.space.uuid;
      if (!spaceUuid) return;

      const lists = queryClient.getQueriesData<ChannelListResponse>({
        queryKey: collabKeys.spaces.channelsPrefix(spaceUuid),
      });
      for (const [qKey, data] of lists) {
        if (!data) continue;
        queryClient.setQueryData<ChannelListResponse>(qKey, {
          ...data,
          data: data.data.map((channel) =>
            channel.uuid === channelUuid
              ? { ...channel, unread_count: unread }
              : channel
          ),
        });
      }
    },
  });
}

/******************************************************************************
                              Members
******************************************************************************/

/** Members of a space (drives the space members panel + role management). */
export function useSpaceMembers(
  spaceUuid: string,
  params: MemberListParams = {},
  options: { enabled?: boolean } = {}
) {
  const enabled = useIsCollabEnabled();

  return useQuery({
    queryKey: collabKeys.spaces.members(spaceUuid, params),
    queryFn: () => spacesApi.getMembers(spaceUuid, params),
    enabled: enabled && !!spaceUuid && (options.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/* ---- Channel membership mutations ---- */

export function useInviteChannelMember(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) =>
      channelsApi.invite(channelUuid, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: collabKeys.channels.membersPrefix(channelUuid),
      });
      queryClient.invalidateQueries({
        queryKey: collabKeys.channels.detail(channelUuid),
      });
    },
  });
}

export function useUpdateChannelMemberRole(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userUuid: string; role: UpdateMemberRolePayload['role'] }) =>
      channelsApi.updateMemberRole(channelUuid, vars.userUuid, { role: vars.role }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: collabKeys.channels.membersPrefix(channelUuid),
      }),
  });
}

export function useRemoveChannelMember(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userUuid: string) =>
      channelsApi.removeMember(channelUuid, userUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: collabKeys.channels.membersPrefix(channelUuid),
      });
      queryClient.invalidateQueries({
        queryKey: collabKeys.channels.detail(channelUuid),
      });
    },
  });
}

export function useSetChannelNotifyLevel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: NotifyLevelPayload) =>
      channelsApi.setNotifyLevel(channelUuid, payload),
    onSuccess: (response) => {
      queryClient.setQueryData<ChannelResponse>(
        collabKeys.channels.detail(channelUuid),
        (old) =>
          old
            ? {
                ...old,
                data: { ...old.data, my_notify_level: response.data.notify_level },
              }
            : old
      );
      queryClient.invalidateQueries({
        queryKey: collabKeys.channels.membersPrefix(channelUuid),
      });
    },
  });
}

/** Invalidate the caches affected by a channel join/leave. */
function invalidateChannelMembership(
  queryClient: ReturnType<typeof useQueryClient>,
  channelUuid: string
) {
  queryClient.invalidateQueries({
    queryKey: collabKeys.channels.detail(channelUuid),
  });
  queryClient.invalidateQueries({
    queryKey: collabKeys.channels.membersPrefix(channelUuid),
  });
  // Message visibility follows membership — a non-member's messages request
  // 403s, so refetch it on join/leave instead of stranding the error state.
  queryClient.invalidateQueries({
    queryKey: collabKeys.channels.messagesPrefix(channelUuid),
  });
  const detail = queryClient.getQueryData<ChannelResponse>(
    collabKeys.channels.detail(channelUuid)
  );
  const spaceUuid = detail?.data.space.uuid;
  if (spaceUuid) {
    queryClient.invalidateQueries({
      queryKey: collabKeys.spaces.channelsPrefix(spaceUuid),
    });
  }
  queryClient.invalidateQueries({ queryKey: collabKeys.spaces.listPrefix });
}

export function useJoinChannel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelsApi.join(channelUuid),
    onSuccess: () => invalidateChannelMembership(queryClient, channelUuid),
  });
}

export function useLeaveChannel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelsApi.leave(channelUuid),
    onSuccess: () => invalidateChannelMembership(queryClient, channelUuid),
  });
}

/* ---- Space membership mutations ---- */

function invalidateSpaceMembers(
  queryClient: ReturnType<typeof useQueryClient>,
  spaceUuid: string
) {
  queryClient.invalidateQueries({
    queryKey: collabKeys.spaces.membersPrefix(spaceUuid),
  });
  queryClient.invalidateQueries({
    queryKey: collabKeys.spaces.detail(spaceUuid),
  });
}

export function useInviteSpaceMember(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) =>
      spacesApi.invite(spaceUuid, payload),
    onSuccess: () => invalidateSpaceMembers(queryClient, spaceUuid),
  });
}

export function useUpdateSpaceMemberRole(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userUuid: string; role: UpdateMemberRolePayload['role'] }) =>
      spacesApi.updateMemberRole(spaceUuid, vars.userUuid, { role: vars.role }),
    onSuccess: () => invalidateSpaceMembers(queryClient, spaceUuid),
  });
}

export function useRemoveSpaceMember(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userUuid: string) => spacesApi.removeMember(spaceUuid, userUuid),
    onSuccess: () => invalidateSpaceMembers(queryClient, spaceUuid),
  });
}

export function useTransferSpaceOwnership(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransferOwnershipPayload) =>
      spacesApi.transferOwnership(spaceUuid, payload),
    onSuccess: () => invalidateSpaceMembers(queryClient, spaceUuid),
  });
}

export function useLeaveSpace(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => spacesApi.leave(spaceUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collabKeys.spaces.listPrefix });
      queryClient.removeQueries({
        queryKey: collabKeys.spaces.detail(spaceUuid),
      });
    },
  });
}

/******************************************************************************
                              Invitations (inbox)
******************************************************************************/

export function useChannelInvitations() {
  const enabled = useIsCollabEnabled();
  return useQuery({
    queryKey: collabKeys.invitations.channels,
    queryFn: () => invitationsApi.channels.list(),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useSpaceInvitations() {
  const enabled = useIsCollabEnabled();
  return useQuery({
    queryKey: collabKeys.invitations.spaces,
    queryFn: () => invitationsApi.spaces.list(),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useOrganizationInvitations() {
  const enabled = useIsCollabEnabled();
  return useQuery({
    queryKey: collabKeys.invitations.organizations,
    queryFn: () => invitationsApi.organizations.list(),
    enabled,
    staleTime: 30 * 1000,
  });
}

/**
 * Count from `pagination.total` when present, else the returned page length —
 * tolerant of inboxes that come back without a pagination block.
 */
function invitationCount(
  response: { data?: unknown[]; pagination?: { total?: number } } | undefined
): number {
  return response?.pagination?.total ?? response?.data?.length ?? 0;
}

/** Total pending invitations across all three inboxes, for the entry badge. */
export function usePendingInvitationCount(): number {
  const channels = useChannelInvitations();
  const spaces = useSpaceInvitations();
  const organizations = useOrganizationInvitations();
  return (
    invitationCount(channels.data) +
    invitationCount(spaces.data) +
    invitationCount(organizations.data)
  );
}

/**
 * Accept / decline an invitation. Accepting can create a new membership, so a
 * broad collab invalidation keeps spaces, channels and the inboxes consistent.
 */
function useInvitationAction(action: (id: number) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: collabKeys.all }),
  });
}

export const useAcceptChannelInvitation = () =>
  useInvitationAction(invitationsApi.channels.accept);
export const useDeclineChannelInvitation = () =>
  useInvitationAction(invitationsApi.channels.decline);
export const useAcceptSpaceInvitation = () =>
  useInvitationAction(invitationsApi.spaces.accept);
export const useDeclineSpaceInvitation = () =>
  useInvitationAction(invitationsApi.spaces.decline);
export const useAcceptOrganizationInvitation = () =>
  useInvitationAction(invitationsApi.organizations.accept);
export const useRejectOrganizationInvitation = () =>
  useInvitationAction(invitationsApi.organizations.reject);

/******************************************************************************
                              Organizations (read)
******************************************************************************/

/** The caller's current organization (or null) — drives org-owned creation. */
export function useMyOrganization() {
  const enabled = useIsCollabEnabled();
  return useQuery({
    queryKey: collabKeys.myOrganization,
    queryFn: () => organizationsApi.myOrganization(),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useOrganizationMembers(
  orgUuid: string,
  params: MemberListParams = {},
  options: { enabled?: boolean } = {}
) {
  const enabled = useIsCollabEnabled();
  return useQuery({
    queryKey: collabKeys.organizations.members(orgUuid, params),
    queryFn: () => organizationsApi.getMembers(orgUuid, params),
    enabled: enabled && !!orgUuid && (options.enabled ?? true),
    staleTime: 30 * 1000,
  });
}

/******************************************************************************
                              Organization mutations
******************************************************************************/

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) =>
      organizationsApi.create(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: collabKeys.myOrganization }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { uuid: string; payload: UpdateOrganizationPayload }) =>
      organizationsApi.update(vars.uuid, vars.payload),
    onSuccess: (_response, vars) => {
      queryClient.invalidateQueries({ queryKey: collabKeys.myOrganization });
      queryClient.invalidateQueries({
        queryKey: collabKeys.organizations.detail(vars.uuid),
      });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => organizationsApi.remove(uuid),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: collabKeys.myOrganization }),
  });
}

function invalidateOrgMembers(
  queryClient: ReturnType<typeof useQueryClient>,
  orgUuid: string
) {
  queryClient.invalidateQueries({
    queryKey: collabKeys.organizations.membersPrefix(orgUuid),
  });
  queryClient.invalidateQueries({ queryKey: collabKeys.myOrganization });
  queryClient.invalidateQueries({
    queryKey: collabKeys.organizations.detail(orgUuid),
  });
}

export function useInviteOrgMember(orgUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) =>
      organizationsApi.invite(orgUuid, payload),
    onSuccess: () => invalidateOrgMembers(queryClient, orgUuid),
  });
}

export function useUpdateOrgMemberRole(orgUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { userUuid: string; role: UpdateMemberRolePayload['role'] }) =>
      organizationsApi.updateMemberRole(orgUuid, vars.userUuid, {
        role: vars.role,
      }),
    onSuccess: () => invalidateOrgMembers(queryClient, orgUuid),
  });
}

export function useRemoveOrgMember(orgUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userUuid: string) =>
      organizationsApi.removeMember(orgUuid, userUuid),
    onSuccess: () => invalidateOrgMembers(queryClient, orgUuid),
  });
}

export function useLeaveMyOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => organizationsApi.leaveMyOrganization(),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: collabKeys.myOrganization }),
  });
}

export function useRequestVerification(orgUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: RequestVerificationPayload) =>
      organizationsApi.requestVerification(orgUuid, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collabKeys.myOrganization });
      queryClient.invalidateQueries({
        queryKey: collabKeys.organizations.detail(orgUuid),
      });
    },
  });
}

/******************************************************************************
                              Space & channel CRUD
******************************************************************************/

export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSpacePayload) => spacesApi.create(payload),
    onSuccess: (response) => {
      queryClient.setQueryData<SpaceResponse>(
        collabKeys.spaces.detail(response.data.uuid),
        response
      );
      queryClient.invalidateQueries({ queryKey: collabKeys.spaces.listPrefix });
    },
  });
}

export function useUpdateSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { uuid: string; payload: UpdateSpacePayload }) =>
      spacesApi.update(vars.uuid, vars.payload),
    onSuccess: (response) => {
      queryClient.setQueryData<SpaceResponse>(
        collabKeys.spaces.detail(response.data.uuid),
        response
      );
      queryClient.invalidateQueries({ queryKey: collabKeys.spaces.listPrefix });
    },
  });
}

export function useDeleteSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => spacesApi.remove(uuid),
    onSuccess: (_response, uuid) => {
      queryClient.invalidateQueries({ queryKey: collabKeys.spaces.listPrefix });
      queryClient.removeQueries({ queryKey: collabKeys.spaces.detail(uuid) });
    },
  });
}

export function useCreateChannel(spaceUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChannelPayload) =>
      channelsApi.create(spaceUuid, payload),
    onSuccess: (response) => {
      queryClient.setQueryData<ChannelResponse>(
        collabKeys.channels.detail(response.data.uuid),
        response
      );
      queryClient.invalidateQueries({
        queryKey: collabKeys.spaces.channelsPrefix(spaceUuid),
      });
    },
  });
}

export function useUpdateChannel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateChannelPayload) =>
      channelsApi.update(channelUuid, payload),
    onSuccess: (response) => {
      queryClient.setQueryData<ChannelResponse>(
        collabKeys.channels.detail(channelUuid),
        response
      );
      queryClient.invalidateQueries({
        queryKey: collabKeys.spaces.channelsPrefix(response.data.space.uuid),
      });
    },
  });
}

export function useDeleteChannel(channelUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => channelsApi.remove(channelUuid),
    onSuccess: () => {
      const detail = queryClient.getQueryData<ChannelResponse>(
        collabKeys.channels.detail(channelUuid)
      );
      const spaceUuid = detail?.data.space.uuid;
      if (spaceUuid) {
        queryClient.invalidateQueries({
          queryKey: collabKeys.spaces.channelsPrefix(spaceUuid),
        });
      }
      queryClient.removeQueries({
        queryKey: collabKeys.channels.detail(channelUuid),
      });
    },
  });
}
