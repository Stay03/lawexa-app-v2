import { apiClient } from './client';
import type { ApiResponse } from '@/types/api';
import type {
  CreateRadarPayload,
  NotificationChannelListResponse,
  NotificationChannelResponse,
  RadarChannelType,
  RadarDetailResponse,
  RadarListParams,
  RadarListResponse,
  RadarScanDetailResponse,
  RadarScanListParams,
  RadarScanListResponse,
  RadarScanResponse,
  SharedRadarScanResponse,
  CreateRadarResponse,
  TriageScanPayload,
  UpdateRadarPayload,
} from '@/types/radar';

/**
 * Radar API service — saved watches scanned on a schedule by an AI agent.
 * Every scan (scheduled or manual) debits one AI message from the user's plan.
 */
export const radarsApi = {
  getList: async (params: RadarListParams = {}): Promise<RadarListResponse> => {
    const response = await apiClient.get<RadarListResponse>('/radars', {
      params: {
        status: params.status || undefined,
        per_page: params.per_page ?? 15,
        page: params.page ?? 1,
      },
    });
    return response.data;
  },

  getByUuid: async (uuid: string): Promise<RadarDetailResponse> => {
    const response = await apiClient.get<RadarDetailResponse>(`/radars/${uuid}`);
    return response.data;
  },

  create: async (payload: CreateRadarPayload): Promise<CreateRadarResponse> => {
    const response = await apiClient.post<CreateRadarResponse>('/radars', payload);
    return response.data;
  },

  // Perimeter arrays replace wholesale: an omitted array is untouched,
  // a present array overwrites the entire stored list.
  update: async (
    uuid: string,
    payload: UpdateRadarPayload
  ): Promise<RadarDetailResponse> => {
    const response = await apiClient.patch<RadarDetailResponse>(
      `/radars/${uuid}`,
      payload
    );
    return response.data;
  },

  pause: async (uuid: string): Promise<RadarDetailResponse> => {
    const response = await apiClient.post<RadarDetailResponse>(
      `/radars/${uuid}/pause`
    );
    return response.data;
  },

  resume: async (uuid: string): Promise<RadarDetailResponse> => {
    const response = await apiClient.post<RadarDetailResponse>(
      `/radars/${uuid}/resume`
    );
    return response.data;
  },

  scanNow: async (uuid: string): Promise<RadarScanResponse> => {
    const response = await apiClient.post<RadarScanResponse>(
      `/radars/${uuid}/scan`
    );
    return response.data;
  },

  // Archiving is permanent in v1 — confirm before calling. Past reports stay readable.
  archive: async (uuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(`/radars/${uuid}`);
    return response.data;
  },

  getScans: async (
    radarUuid: string,
    params: RadarScanListParams = {}
  ): Promise<RadarScanListResponse> => {
    const response = await apiClient.get<RadarScanListResponse>(
      `/radars/${radarUuid}/scans`,
      {
        params: {
          status: params.status || undefined,
          workflow_status: params.workflow_status || undefined,
          unread: params.unread ? 1 : undefined,
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  getScan: async (
    radarUuid: string,
    scanUuid: string
  ): Promise<RadarScanDetailResponse> => {
    const response = await apiClient.get<RadarScanDetailResponse>(
      `/radars/${radarUuid}/scans/${scanUuid}`
    );
    return response.data;
  },

  triageScan: async (
    radarUuid: string,
    scanUuid: string,
    payload: TriageScanPayload
  ): Promise<RadarScanResponse> => {
    const response = await apiClient.patch<RadarScanResponse>(
      `/radars/${radarUuid}/scans/${scanUuid}`,
      payload
    );
    return response.data;
  },

  // ── Scan report sharing ──────────────────────────────────────────────
  // Owner-only. 422 unless the scan is completed with a report. Each returns
  // the owner scan payload with the updated `is_private`.
  publishScan: async (radarUuid: string, scanUuid: string): Promise<RadarScanResponse> => {
    const response = await apiClient.post<RadarScanResponse>(
      `/radars/${radarUuid}/scans/${scanUuid}/publish`
    );
    return response.data;
  },

  unpublishScan: async (radarUuid: string, scanUuid: string): Promise<RadarScanResponse> => {
    const response = await apiClient.post<RadarScanResponse>(
      `/radars/${radarUuid}/scans/${scanUuid}/unpublish`
    );
    return response.data;
  },

  toggleScanVisibility: async (radarUuid: string, scanUuid: string): Promise<RadarScanResponse> => {
    const response = await apiClient.post<RadarScanResponse>(
      `/radars/${radarUuid}/scans/${scanUuid}/toggle-visibility`
    );
    return response.data;
  },

  // Public (no-auth) read of a published scan — trimmed reader shape, 404 if
  // still private. Used for logged-out / guest viewers and link previews.
  getPublicScan: async (
    radarUuid: string,
    scanUuid: string
  ): Promise<SharedRadarScanResponse> => {
    const response = await apiClient.get<SharedRadarScanResponse>(
      `/public/radars/${radarUuid}/scans/${scanUuid}`
    );
    return response.data;
  },
};

export const notificationChannelsApi = {
  getList: async (): Promise<NotificationChannelListResponse> => {
    const response = await apiClient.get<NotificationChannelListResponse>(
      '/notification-channels'
    );
    return response.data;
  },

  // Idempotent — creating an existing channel returns the same record.
  create: async (type: RadarChannelType): Promise<NotificationChannelResponse> => {
    const response = await apiClient.post<NotificationChannelResponse>(
      '/notification-channels',
      { type }
    );
    return response.data;
  },

  // The in_app channel cannot be deleted (422 — baseline delivery channel).
  remove: async (uuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      `/notification-channels/${uuid}`
    );
    return response.data;
  },
};
