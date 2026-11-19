import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { firmTemplatesApi, myTemplatesApi, mySkillsApi, privateItemGrantsApi, privateItemRequestsApi } from '@/lib/api/private-items';
import type { ItemsPage, MySkill, MySkillInput, MyTemplate, PrivateItemChoice } from '@/types/private-items';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Reads and writes for a user's own templates and skills, a firm's templates
 * and the ask-first requests (thread 9ae498ae; Backend's contract, 19 November
 * 2026). The lists are short, so one page of 50 is read first and "Show more"
 * reads the next.
 */
const PER_PAGE = 50;

const nextPage = <Row,>(last: ItemsPage<Row>) =>
  last.pagination.current_page < last.pagination.last_page ? last.pagination.current_page + 1 : undefined;

/** While any template is still being read, its list asks again every few seconds (the push is the fast path). */
const READING_POLL_MS = 5000;
const anyReading = (data: InfiniteData<ItemsPage<{ status: string }>> | undefined) =>
  data?.pages.some((page) => page.data.some((row) => row.status === 'processing')) ?? false;

export const privateItemsQueries = {
  templates: ['private-items', 'templates'] as const,
  skills: ['private-items', 'skills'] as const,
  firm: (orgUuid: string) => ['private-items', 'firm', orgUuid] as const,
  requests: (conversationUuid: string) => ['private-items', 'requests', conversationUuid] as const,

  myTemplates: (search = '') =>
    infiniteQueryOptions({
      queryKey: [...privateItemsQueries.templates, search],
      queryFn: ({ pageParam }) => myTemplatesApi.list({ search: search || undefined, page: pageParam, per_page: PER_PAGE }),
      initialPageParam: 1,
      getNextPageParam: nextPage,
      staleTime: STALE_TIMES.standard,
      refetchInterval: (query) => (anyReading(query.state.data) ? READING_POLL_MS : false),
    }),

  mySkills: (search = '') =>
    infiniteQueryOptions({
      queryKey: [...privateItemsQueries.skills, search],
      queryFn: ({ pageParam }) => mySkillsApi.list({ search: search || undefined, page: pageParam, per_page: PER_PAGE }),
      initialPageParam: 1,
      getNextPageParam: nextPage,
      staleTime: STALE_TIMES.standard,
    }),

  firmTemplates: (orgUuid: string) =>
    infiniteQueryOptions({
      queryKey: privateItemsQueries.firm(orgUuid),
      queryFn: ({ pageParam }) => firmTemplatesApi.list(orgUuid, { page: pageParam, per_page: PER_PAGE }),
      initialPageParam: 1,
      getNextPageParam: nextPage,
      staleTime: STALE_TIMES.standard,
      refetchInterval: (query) => (anyReading(query.state.data) ? READING_POLL_MS : false),
    }),

  /** The caller's own pending ask-first requests in one chat. */
  chatRequests: (conversationUuid: string, enabled: boolean) =>
    queryOptions({
      queryKey: privateItemsQueries.requests(conversationUuid),
      queryFn: () => privateItemRequestsApi.list(conversationUuid),
      enabled,
      staleTime: STALE_TIMES.standard,
      // A reply that asked mounts its row after the chat was read: read again
      // then, so the owner's card shows even when no push arrives (a dropped
      // socket, or a server with broadcasting off). The rows that mount
      // together share one read.
      refetchOnMount: 'always',
      meta: { silentError: true },
    }),
};

/** Put a changed template row into every cached page that holds it. */
function patchTemplate(rows: InfiniteData<ItemsPage<MyTemplate>> | undefined, row: MyTemplate) {
  if (!rows) return rows;
  return { ...rows, pages: rows.pages.map((page) => ({ ...page, data: page.data.map((r) => (r.uuid === row.uuid ? row : r)) })) };
}

export function useTemplateMutations() {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: privateItemsQueries.templates });
  const land = (row: MyTemplate) =>
    client.setQueriesData<InfiniteData<ItemsPage<MyTemplate>>>({ queryKey: privateItemsQueries.templates }, (rows) =>
      patchTemplate(rows, row),
    );
  return {
    upload: useMutation({ mutationFn: myTemplatesApi.upload, onSettled: refresh, meta: { silentError: true } }),
    rename: useMutation({
      mutationFn: ({ uuid, name }: { uuid: string; name: string }) => myTemplatesApi.rename(uuid, name),
      onSuccess: land,
      meta: { silentError: true },
    }),
    retry: useMutation({ mutationFn: myTemplatesApi.retry, onSuccess: land, meta: { silentError: true } }),
    remove: useMutation({ mutationFn: myTemplatesApi.remove, onSettled: refresh, meta: { silentError: true } }),
  };
}

export function useSkillMutations() {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: privateItemsQueries.skills });
  return {
    create: useMutation({ mutationFn: (input: MySkillInput) => mySkillsApi.create(input), onSuccess: refresh, meta: { silentError: true } }),
    update: useMutation({
      mutationFn: ({ uuid, input }: { uuid: string; input: MySkillInput }): Promise<MySkill> => mySkillsApi.update(uuid, input),
      onSuccess: refresh,
      meta: { silentError: true },
    }),
    remove: useMutation({ mutationFn: mySkillsApi.remove, onSettled: refresh, meta: { silentError: true } }),
  };
}

/** End an "always in this Space"; both lists carry `allowed_in`, so both are read again. */
export function useRevokeGrant() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: privateItemGrantsApi.revoke,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: privateItemsQueries.templates });
      void client.invalidateQueries({ queryKey: privateItemsQueries.skills });
    },
    meta: { silentError: true },
  });
}

export function useFirmTemplateMutations(orgUuid: string) {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: privateItemsQueries.firm(orgUuid) });
  return {
    upload: useMutation({ mutationFn: (files: File[]) => firmTemplatesApi.upload(orgUuid, files), onSettled: refresh, meta: { silentError: true } }),
    rename: useMutation({
      mutationFn: ({ uuid, name }: { uuid: string; name: string }) => firmTemplatesApi.rename(orgUuid, uuid, name),
      onSettled: refresh,
      meta: { silentError: true },
    }),
    retry: useMutation({ mutationFn: (uuid: string) => firmTemplatesApi.retry(orgUuid, uuid), onSettled: refresh, meta: { silentError: true } }),
    remove: useMutation({ mutationFn: (uuid: string) => firmTemplatesApi.remove(orgUuid, uuid), onSettled: refresh, meta: { silentError: true } }),
  };
}

export function useAnswerRequest(conversationUuid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, choice }: { uuid: string; choice: PrivateItemChoice }) => privateItemRequestsApi.answer(uuid, choice),
    onSettled: () => void client.invalidateQueries({ queryKey: privateItemsQueries.requests(conversationUuid) }),
    meta: { silentError: true },
  });
}

