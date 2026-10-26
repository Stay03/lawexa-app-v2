import { apiClient } from './client';
import { filenameFromDisposition, type ExportedFile } from './export';
import type { ApiResponse } from '@/types/api';
import type { SpaceRadarListParams, SpaceRadarListResponse } from '@/types/collab';
import type {
  CreateRadarPayload,
  CreateSpaceRadarPayload,
  RadarExportFormat,
  UpdateSpaceRadarPayload,
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

/**
 * ── RADARS IN A SPACE (Backend's contract, 26 October 2026) ─────────────────
 * The personal routes above, under `/spaces/{space}/radars`. Any member reads;
 * an Owner or Editor creates; the creator, the Space's owners and (team Space)
 * admins edit, pause, resume, scan now, archive and publish. The Space's owner
 * pays for the scans. A Space Radar never shows in `GET /radars`.
 *
 * Read state is PER MEMBER: `triageScan` with `read` sets or clears the
 * caller's own read only. `workflow_status` and `priority` are shared.
 */
const spaceRadarsPath = (spaceUuid: string, radarUuid?: string): string =>
  radarUuid
    ? `/spaces/${encodeURIComponent(spaceUuid)}/radars/${encodeURIComponent(radarUuid)}`
    : `/spaces/${encodeURIComponent(spaceUuid)}/radars`;

export const spaceRadarsApi = {
  getList: async (spaceUuid: string, params: SpaceRadarListParams = {}): Promise<SpaceRadarListResponse> => {
    const response = await apiClient.get<SpaceRadarListResponse>(spaceRadarsPath(spaceUuid), {
      params: {
        status: params.status || undefined,
        per_page: params.per_page ?? 15,
        page: params.page ?? 1,
      },
    });
    return response.data;
  },

  get: async (spaceUuid: string, radarUuid: string): Promise<RadarDetailResponse> => {
    const response = await apiClient.get<RadarDetailResponse>(spaceRadarsPath(spaceUuid, radarUuid));
    return response.data;
  },

  // 201 with the personal create's body. `first_scan.block_reason` is about
  // the PAYER, the Space's owner, not the member creating it.
  create: async (spaceUuid: string, payload: CreateSpaceRadarPayload): Promise<CreateRadarResponse> => {
    const response = await apiClient.post<CreateRadarResponse>(spaceRadarsPath(spaceUuid), payload);
    return response.data;
  },

  // Arrays replace wholesale, as on the personal route.
  update: async (
    spaceUuid: string,
    radarUuid: string,
    payload: UpdateSpaceRadarPayload,
  ): Promise<RadarDetailResponse> => {
    const response = await apiClient.patch<RadarDetailResponse>(spaceRadarsPath(spaceUuid, radarUuid), payload);
    return response.data;
  },

  pause: async (spaceUuid: string, radarUuid: string): Promise<RadarDetailResponse> => {
    const response = await apiClient.post<RadarDetailResponse>(`${spaceRadarsPath(spaceUuid, radarUuid)}/pause`);
    return response.data;
  },

  resume: async (spaceUuid: string, radarUuid: string): Promise<RadarDetailResponse> => {
    const response = await apiClient.post<RadarDetailResponse>(`${spaceRadarsPath(spaceUuid, radarUuid)}/resume`);
    return response.data;
  },

  scanNow: async (spaceUuid: string, radarUuid: string): Promise<RadarScanResponse> => {
    const response = await apiClient.post<RadarScanResponse>(`${spaceRadarsPath(spaceUuid, radarUuid)}/scan`);
    return response.data;
  },

  // Permanent, as on the personal route. Past reports stay in the Space.
  archive: async (spaceUuid: string, radarUuid: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(spaceRadarsPath(spaceUuid, radarUuid));
    return response.data;
  },

  getScans: async (
    spaceUuid: string,
    radarUuid: string,
    params: RadarScanListParams = {},
  ): Promise<RadarScanListResponse> => {
    const response = await apiClient.get<RadarScanListResponse>(`${spaceRadarsPath(spaceUuid, radarUuid)}/scans`, {
      params: {
        status: params.status || undefined,
        workflow_status: params.workflow_status || undefined,
        unread: params.unread ? 1 : undefined,
        per_page: params.per_page ?? 15,
        page: params.page ?? 1,
      },
    });
    return response.data;
  },

  getScan: async (spaceUuid: string, radarUuid: string, scanUuid: string): Promise<RadarScanDetailResponse> => {
    const response = await apiClient.get<RadarScanDetailResponse>(
      `${spaceRadarsPath(spaceUuid, radarUuid)}/scans/${encodeURIComponent(scanUuid)}`,
    );
    return response.data;
  },

  triageScan: async (
    spaceUuid: string,
    radarUuid: string,
    scanUuid: string,
    payload: TriageScanPayload,
  ): Promise<RadarScanResponse> => {
    const response = await apiClient.patch<RadarScanResponse>(
      `${spaceRadarsPath(spaceUuid, radarUuid)}/scans/${encodeURIComponent(scanUuid)}`,
      payload,
    );
    return response.data;
  },

  publishScan: async (spaceUuid: string, radarUuid: string, scanUuid: string): Promise<RadarScanResponse> => {
    const response = await apiClient.post<RadarScanResponse>(
      `${spaceRadarsPath(spaceUuid, radarUuid)}/scans/${encodeURIComponent(scanUuid)}/publish`,
    );
    return response.data;
  },

  unpublishScan: async (spaceUuid: string, radarUuid: string, scanUuid: string): Promise<RadarScanResponse> => {
    const response = await apiClient.post<RadarScanResponse>(
      `${spaceRadarsPath(spaceUuid, radarUuid)}/scans/${encodeURIComponent(scanUuid)}/unpublish`,
    );
    return response.data;
  },

  /**
   * A report as Word or PDF (`GET /radars/{radar}/scans/{scan}/export`), for
   * any member of the Radar's Space. Nothing is stored; the answer is the
   * file, named by its `Content-Disposition`. 20 a minute per user.
   */
  exportScan: async (radarUuid: string, scanUuid: string, format: RadarExportFormat): Promise<ExportedFile> => {
    const response = await apiClient.get<Blob>(
      `/radars/${encodeURIComponent(radarUuid)}/scans/${encodeURIComponent(scanUuid)}/export`,
      { params: { format }, responseType: 'blob' },
    );
    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition'], radarReportFallbackName(format)),
    };
  },
};

/** The name a report's file takes when the server sends none. */
export function radarReportFallbackName(format: RadarExportFormat): string {
  return `lawexa-radar-report.${format}`;
}

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
