'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { adminTemplatesApi } from '@/lib/api/admin-templates';
import { extractApiError } from '@/lib/utils/api-error';
import { anyProcessing, PROCESSING_POLL_MS } from '@/components/admin/templates/template-model';
import type { AdminTemplateListParams, AdminTemplateUpdatePayload } from '@/types/admin-templates';

export const adminTemplateKeys = {
  all: ['admin', 'templates'] as const,
  lists: () => [...adminTemplateKeys.all, 'list'] as const,
  list: (params: AdminTemplateListParams) => [...adminTemplateKeys.lists(), params] as const,
  facets: () => [...adminTemplateKeys.all, 'facets'] as const,
  detail: (uuid: string) => [...adminTemplateKeys.all, 'detail', uuid] as const,
};

/** The list; while any template on the page is being read, asked again every 5 s. */
export function useAdminTemplates(params: AdminTemplateListParams) {
  return useQuery({
    queryKey: adminTemplateKeys.list(params),
    queryFn: () => adminTemplatesApi.getList(params),
    staleTime: 15 * 1000,
    refetchInterval: (query) => (anyProcessing(query.state.data?.data ?? []) ? PROCESSING_POLL_MS : false),
  });
}

/** The labels in use, for the filters and the fields' suggestions. */
export function useAdminTemplateFacets() {
  return useQuery({
    queryKey: adminTemplateKeys.facets(),
    queryFn: async () => (await adminTemplatesApi.getFacets()).data,
    staleTime: 60 * 1000,
  });
}

/** One template; while it is being read, asked again every 5 s. */
export function useAdminTemplate(uuid: string) {
  return useQuery({
    queryKey: adminTemplateKeys.detail(uuid),
    queryFn: async () => {
      const answer = await adminTemplatesApi.get(uuid);
      if (!answer.data) throw new Error(answer.message || 'The template did not load.');
      return answer.data;
    },
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? PROCESSING_POLL_MS : false),
  });
}

/** After any write: the lists, the labels and this template are read again. */
function useRefresh() {
  const queryClient = useQueryClient();
  return (uuid?: string) => {
    void queryClient.invalidateQueries({ queryKey: adminTemplateKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: adminTemplateKeys.facets() });
    if (uuid) void queryClient.invalidateQueries({ queryKey: adminTemplateKeys.detail(uuid) });
  };
}

export function useUploadTemplates() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (files: readonly File[]) => adminTemplatesApi.upload(files),
    onSuccess: () => refresh(),
    onError: (error) => toast.error(extractApiError(error).message || 'The upload did not go through.'),
  });
}

export function useUpdateTemplate(uuid: string) {
  const queryClient = useQueryClient();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (payload: AdminTemplateUpdatePayload) => adminTemplatesApi.update(uuid, payload),
    onSuccess: (answer) => {
      if (answer.data) queryClient.setQueryData(adminTemplateKeys.detail(uuid), answer.data);
      refresh();
      toast.success('Saved');
    },
    onError: (error) => toast.error(extractApiError(error).message || 'The changes did not save.'),
  });
}

/** Approve, unpublish or retry: each answers with the row, then the template is read again. */
export function useTemplateAction(uuid: string, action: 'approve' | 'unpublish' | 'retry') {
  const refresh = useRefresh();
  const done = { approve: 'The template is live.', unpublish: 'The template is a draft again.', retry: 'Lawexa is reading the file again.' }[action];
  return useMutation({
    mutationFn: () => adminTemplatesApi[action](uuid),
    onSuccess: () => {
      refresh(uuid);
      toast.success(done);
    },
    onError: (error) => toast.error(extractApiError(error).message || 'That did not go through. Try again.'),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => adminTemplatesApi.remove(uuid),
    onSuccess: (_answer, uuid) => {
      queryClient.removeQueries({ queryKey: adminTemplateKeys.detail(uuid) });
      void queryClient.invalidateQueries({ queryKey: adminTemplateKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: adminTemplateKeys.facets() });
      toast.success('The template is deleted.');
    },
    onError: (error) => toast.error(extractApiError(error).message || 'The template was not deleted.'),
  });
}

/** The uploaded file, saved under its original name. */
export function useDownloadTemplateSource() {
  return useMutation({
    mutationFn: async ({ uuid, name }: { uuid: string; name: string }) => {
      const { blob, filename } = await adminTemplatesApi.download(uuid, name);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => toast.error(extractApiError(error).message || 'The file did not download.'),
  });
}
