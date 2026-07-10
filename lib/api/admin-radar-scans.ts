// Admin Radar scan observability — API service
import { apiClient } from './client';
import type { ApiResponse, PaginatedResponse } from '@/types/admin-cases';
import type {
  RadarScan,
  RadarScanSummary,
  RadarScansParams,
} from '@/types/admin-radar-scans';

async function getScans(
  params: RadarScansParams = {}
): Promise<PaginatedResponse<RadarScan>> {
  const { has_findings, ...rest } = params;
  const response = await apiClient.get<PaginatedResponse<RadarScan>>(
    '/admin/radar-scans',
    {
      params: {
        ...rest,
        // Backend accepts true/false; only send when set.
        has_findings: has_findings === undefined ? undefined : String(has_findings),
      },
    }
  );
  return response.data;
}

async function getScanSummary(): Promise<ApiResponse<RadarScanSummary>> {
  const response = await apiClient.get<ApiResponse<RadarScanSummary>>(
    '/admin/radar-scans/summary'
  );
  return response.data;
}

export const adminRadarScansApi = {
  getScans,
  getScanSummary,
};
