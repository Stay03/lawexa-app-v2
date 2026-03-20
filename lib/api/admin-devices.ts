import { apiClient } from './client';
import type {
  DeviceListParams,
  DeviceListResponse,
  SharedDeviceParams,
  SharedDeviceResponse,
  IpClusterParams,
  IpClusterResponse,
  UserDeviceHistoryParams,
  UserDeviceHistoryResponse,
} from '@/types/admin-devices';

/**
 * Admin device intelligence API service
 */
export const adminDevicesApi = {
  /**
   * List all device records with filtering, sorting, and pagination
   */
  getDevices: async (
    params: DeviceListParams = {}
  ): Promise<DeviceListResponse> => {
    const response = await apiClient.get<DeviceListResponse>(
      '/admin/devices',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          search: params.search || undefined,
          country: params.country || undefined,
          device_type: params.device_type || undefined,
          browser: params.browser || undefined,
          platform: params.platform || undefined,
          'role[]': params['role[]']?.length ? params['role[]'] : undefined,
          date_from: params.date_from || undefined,
          date_to: params.date_to || undefined,
          sort_by: params.sort_by || 'last_active_at',
          sort_order: params.sort_order || 'desc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get shared device report grouped by fingerprint or device_id
   */
  getSharedDevices: async (
    params: SharedDeviceParams
  ): Promise<SharedDeviceResponse> => {
    const response = await apiClient.get<SharedDeviceResponse>(
      '/admin/devices/shared',
      {
        params: {
          group_by: params.group_by,
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  /**
   * Get IP cluster analysis
   */
  getIpClusters: async (
    params: IpClusterParams = {}
  ): Promise<IpClusterResponse> => {
    const response = await apiClient.get<IpClusterResponse>(
      '/admin/devices/ip-clusters',
      {
        params: {
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },

  /**
   * Get device history for a specific user
   */
  getUserDevices: async (
    uuid: string,
    params: UserDeviceHistoryParams = {}
  ): Promise<UserDeviceHistoryResponse> => {
    const response = await apiClient.get<UserDeviceHistoryResponse>(
      `/admin/users/${uuid}/devices`,
      {
        params: {
          per_page: params.per_page ?? 15,
          page: params.page ?? 1,
        },
      }
    );
    return response.data;
  },
};
