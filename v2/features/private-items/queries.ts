import { infiniteQueryOptions, queryOptions, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import { firmTemplatesApi, myTemplatesApi, mySkillsApi, privateItemGrantsApi, privateItemRequestsApi } from '@/lib/api/private-items';
import type {
  BlankEdit,
  ItemsPage,
  MySkill,
  MySkillInput,
  MyTemplate,
  PrivateItemChoice,
  PrivateItemKind,
  TemplateSort,
} from '@/types/private-items';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Reads and writes for a user's own templates and skills, a firm's templates
 * and the ask-first requests (thread 9ae498ae; Backend's contract, 19 November
 * 2026). The lists are short, so one page of 50 is read first and "Show more"
 * reads the next.
 */
const PER_PAGE = 50;
const RECENT_COUNT = 5;
const TEST_POLL_MS = 2500;

/** What My templates is showing: the search and the two filters, and the order. */
export interface TemplateFilters {
  search?: string;
  documentType?: string;
  practiceArea?: string;
  sort?: TemplateSort;
}

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

  myTemplates: (filters: TemplateFilters = {}) =>
    infiniteQueryOptions({
      queryKey: [...privateItemsQueries.templates, 'list', filters],
      queryFn: ({ pageParam }) =>
        myTemplatesApi.list({
          search: filters.search || undefined,
          document_type: filters.documentType || undefined,
          practice_area: filters.practiceArea || undefined,
          sort: filters.sort,
          page: pageParam,
          per_page: PER_PAGE,
        }),
      initialPageParam: 1,
      getNextPageParam: nextPage,
      staleTime: STALE_TIMES.standard,
      refetchInterval: (query) => (anyReading(query.state.data) ? READING_POLL_MS : false),
    }),

  /** The five used last, for the row at the top. */
  recentTemplates: () =>
    queryOptions({
      queryKey: [...privateItemsQueries.templates, 'recent'],
      queryFn: async () => (await myTemplatesApi.list({ sort: 'last_used', per_page: RECENT_COUNT })).data,
      staleTime: STALE_TIMES.standard,
    }),

  templateFacets: () =>
    queryOptions({
      queryKey: [...privateItemsQueries.templates, 'facets'],
      queryFn: myTemplatesApi.facets,
      staleTime: STALE_TIMES.standard,
    }),

  template: (uuid: string) =>
    queryOptions({
      queryKey: [...privateItemsQueries.templates, 'one', uuid],
      queryFn: () => myTemplatesApi.get(uuid),
      staleTime: STALE_TIMES.standard,
    }),

  versions: (kind: PrivateItemKind, uuid: string) =>
    queryOptions({
      queryKey: [...(kind === 'template' ? privateItemsQueries.templates : privateItemsQueries.skills), 'versions', uuid],
      queryFn: () => (kind === 'template' ? myTemplatesApi.versions(uuid) : mySkillsApi.versions(uuid)),
      staleTime: STALE_TIMES.standard,
    }),

  templateVersion: (uuid: string, version: number) =>
    queryOptions({
      queryKey: [...privateItemsQueries.templates, 'version', uuid, version],
      queryFn: () => myTemplatesApi.version(uuid, version),
      staleTime: Infinity,
    }),

  /** A started test run, read every 2.5 s until it is done or failed (Backend: poll every 2-3 s). */
  skillTestRun: (runUuid: string | null) =>
    queryOptions({
      queryKey: [...privateItemsQueries.skills, 'test-run', runUuid],
      queryFn: () => mySkillsApi.testRun(runUuid!),
      enabled: runUuid !== null,
      refetchInterval: (query) => (query.state.data?.status === 'running' || !query.state.data ? TEST_POLL_MS : false),
      staleTime: 0,
      gcTime: 60_000,
      meta: { silentError: true },
    }),

  skillVersion: (uuid: string, version: number) =>
    queryOptions({
      queryKey: [...privateItemsQueries.skills, 'version', uuid, version],
      queryFn: () => mySkillsApi.version(uuid, version),
      staleTime: Infinity,
    }),

  mySkills: (search = '') =>
    infiniteQueryOptions({
      queryKey: [...privateItemsQueries.skills, 'list', search],
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
    // Only the paged lists: the same key also holds one template, the facets and the versions.
    client.setQueriesData<InfiniteData<ItemsPage<MyTemplate>>>({ queryKey: [...privateItemsQueries.templates, 'list'] }, (rows) =>
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
    duplicate: useMutation({ mutationFn: myTemplatesApi.duplicate, onSettled: refresh, meta: { silentError: true } }),
    replace: useMutation({
      mutationFn: ({ uuid, file }: { uuid: string; file: File }) => myTemplatesApi.replace(uuid, file),
      onSettled: refresh,
      meta: { silentError: true },
    }),
    saveBlanks: useMutation({
      mutationFn: ({ uuid, edits }: { uuid: string; edits: BlankEdit[] }) => myTemplatesApi.saveBlanks(uuid, edits),
      onSettled: refresh,
      meta: { silentError: true },
    }),
    restore: useMutation({
      mutationFn: ({ uuid, version }: { uuid: string; version: number }) => myTemplatesApi.restore(uuid, version),
      onSettled: refresh,
      meta: { silentError: true },
    }),
  };
}

export function useSkillMutations() {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: privateItemsQueries.skills });
  return {
    create: useMutation({ mutationFn: (input: MySkillInput) => mySkillsApi.create(input), onSuccess: refresh, meta: { silentError: true } }),
    update: useMutation({
      mutationFn: ({ uuid, input }: { uuid: string; input: Partial<MySkillInput> }): Promise<MySkill> =>
        mySkillsApi.update(uuid, input),
      onSuccess: refresh,
      meta: { silentError: true },
    }),
    remove: useMutation({ mutationFn: mySkillsApi.remove, onSettled: refresh, meta: { silentError: true } }),
    duplicate: useMutation({ mutationFn: mySkillsApi.duplicate, onSettled: refresh, meta: { silentError: true } }),
    restore: useMutation({
      mutationFn: ({ uuid, version }: { uuid: string; version: number }) => mySkillsApi.restore(uuid, version),
      onSettled: refresh,
      meta: { silentError: true },
    }),
    /** Starts a test run: a saved skill by its uuid (with any unsaved edit); a new one sends all its fields. */
    test: useMutation({
      mutationFn: ({ uuid, request, input }: { uuid: string | null; request: string; input: MySkillInput }) =>
        uuid
          ? mySkillsApi.test(uuid, { request, instructions: input.instructions, example_output: input.example_output })
          : mySkillsApi.testNew({ request, ...input }),
      meta: { silentError: true },
    }),
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

