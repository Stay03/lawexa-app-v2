'use client';

import { useQuery } from '@tanstack/react-query';
import { adminDevicesApi } from '@/lib/api/admin-devices';
import type {
  DeviceListParams,
  SharedDeviceParams,
  IpClusterParams,
  UserDeviceHistoryParams,
} from '@/types/admin-devices';

// Query key factory
export const adminDeviceKeys = {
  all: ['admin', 'devices'] as const,
  devices: () => [...adminDeviceKeys.all, 'list'] as const,
  devicesList: (params: DeviceListParams) =>
    [...adminDeviceKeys.devices(), params] as const,
  shared: () => [...adminDeviceKeys.all, 'shared'] as const,
  sharedList: (params: SharedDeviceParams) =>
    [...adminDeviceKeys.shared(), params] as const,
  ipClusters: () => [...adminDeviceKeys.all, 'ip-clusters'] as const,
  ipClustersList: (params: IpClusterParams) =>
    [...adminDeviceKeys.ipClusters(), params] as const,
  userDevices: (uuid: string) =>
    [...adminDeviceKeys.all, 'user', uuid] as const,
  userDevicesList: (uuid: string, params: UserDeviceHistoryParams) =>
    [...adminDeviceKeys.userDevices(uuid), params] as const,
};

/**
 * Hook for fetching admin device list with pagination, filtering, sorting
 */
export function useAdminDevices(
  params: DeviceListParams = {},
  enabled = true
) {
  return useQuery({
    queryKey: adminDeviceKeys.devicesList(params),
    queryFn: () => adminDevicesApi.getDevices(params),
    staleTime: 30_000,
    enabled,
  });
}

/**
 * Hook for fetching shared device groups (abuse detection)
 */
export function useAdminSharedDevices(
  params: SharedDeviceParams,
  enabled = true
) {
  return useQuery({
    queryKey: adminDeviceKeys.sharedList(params),
    queryFn: () => adminDevicesApi.getSharedDevices(params),
    staleTime: 30_000,
    enabled,
  });
}

/**
 * Hook for fetching IP clusters
 */
export function useAdminIpClusters(
  params: IpClusterParams = {},
  enabled = true
) {
  return useQuery({
    queryKey: adminDeviceKeys.ipClustersList(params),
    queryFn: () => adminDevicesApi.getIpClusters(params),
    staleTime: 30_000,
    enabled,
  });
}

/**
 * Hook for fetching a specific user's device history
 */
export function useAdminUserDevices(
  uuid: string | null,
  params: UserDeviceHistoryParams = {}
) {
  return useQuery({
    queryKey: adminDeviceKeys.userDevicesList(uuid ?? '', params),
    queryFn: () => adminDevicesApi.getUserDevices(uuid!, params),
    enabled: !!uuid,
    staleTime: 30_000,
  });
}
