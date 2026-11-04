import { apiClient } from './client';
import { filenameFromDisposition, type ExportedFile } from './export';
import type { ApiResponse } from '@/types/api';
import type {
  AdminTemplateDetail,
  AdminTemplateFacets,
  AdminTemplateListParams,
  AdminTemplateListResponse,
  AdminTemplateRow,
  AdminTemplateUpdatePayload,
  AdminTemplateUploadResult,
} from '@/types/admin-templates';

const BASE = '/admin/templates';
const path = (uuid: string, action?: string) =>
  `${BASE}/${encodeURIComponent(uuid)}${action ? `/${action}` : ''}`;

/**
 * Lawexa's templates, for admins (Backend's contract, 4 November 2026):
 * the list, the labels in use, a batch upload (at most 20 files, each up to
 * 20 MB, Word, RTF or PDF), one template with its texts, edit, approve,
 * unpublish, retry, delete and the original file.
 */
export const adminTemplatesApi = {
  getList: async (params: AdminTemplateListParams = {}): Promise<AdminTemplateListResponse> => {
    const response = await apiClient.get<AdminTemplateListResponse>(BASE, {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        search: params.search || undefined,
        status: params.status || undefined,
        practice_area: params.practice_area || undefined,
        document_type: params.document_type || undefined,
        country_id: params.country_id || undefined,
      },
    });
    return response.data;
  },

  getFacets: async (): Promise<ApiResponse<AdminTemplateFacets>> => {
    const response = await apiClient.get<ApiResponse<AdminTemplateFacets>>(`${BASE}/facets`);
    return response.data;
  },

  /** `practiceArea`: every template from this upload starts with it, and Lawexa's reading keeps it. */
  upload: async (files: readonly File[], practiceArea?: string | null): Promise<ApiResponse<AdminTemplateUploadResult>> => {
    const form = new FormData();
    for (const file of files) form.append('files[]', file);
    if (practiceArea) form.append('practice_area', practiceArea);
    const response = await apiClient.post<ApiResponse<AdminTemplateUploadResult>>(BASE, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  get: async (uuid: string): Promise<ApiResponse<AdminTemplateDetail>> => {
    const response = await apiClient.get<ApiResponse<AdminTemplateDetail>>(path(uuid));
    return response.data;
  },

  update: async (uuid: string, payload: AdminTemplateUpdatePayload): Promise<ApiResponse<AdminTemplateDetail>> => {
    const response = await apiClient.patch<ApiResponse<AdminTemplateDetail>>(path(uuid), payload);
    return response.data;
  },

  approve: async (uuid: string): Promise<ApiResponse<AdminTemplateRow>> => {
    const response = await apiClient.post<ApiResponse<AdminTemplateRow>>(path(uuid, 'approve'));
    return response.data;
  },

  unpublish: async (uuid: string): Promise<ApiResponse<AdminTemplateRow>> => {
    const response = await apiClient.post<ApiResponse<AdminTemplateRow>>(path(uuid, 'unpublish'));
    return response.data;
  },

  retry: async (uuid: string): Promise<ApiResponse<AdminTemplateRow>> => {
    const response = await apiClient.post<ApiResponse<AdminTemplateRow>>(path(uuid, 'retry'));
    return response.data;
  },

  remove: async (uuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(path(uuid));
    return response.data;
  },

  /** The uploaded file, with its original name. */
  download: async (uuid: string, fallbackName: string): Promise<ExportedFile> => {
    const response = await apiClient.get<Blob>(path(uuid, 'download'), { responseType: 'blob' });
    return { blob: response.data, filename: filenameFromDisposition(response.headers['content-disposition'], fallbackName) };
  },
};
