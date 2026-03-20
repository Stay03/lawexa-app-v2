'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminPagination } from '@/components/admin';
import { DeviceFilters } from '@/components/admin/devices/DeviceFilters';
import { DevicesTable } from '@/components/admin/devices/DevicesTable';
import { SharedDevicesTable } from '@/components/admin/devices/SharedDevicesTable';
import { IpClustersTable } from '@/components/admin/devices/IpClustersTable';
import { UserDeviceHistorySheet } from '@/components/admin/devices/UserDeviceHistorySheet';
import {
  useAdminDevices,
  useAdminSharedDevices,
  useAdminIpClusters,
} from '@/lib/hooks/useAdminDevices';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { cn } from '@/lib/utils';
import {
  Monitor,
  Fingerprint,
  Globe,
} from 'lucide-react';
import type {
  DeviceTab,
  DeviceListParams,
  DeviceSortBy,
  SharedDeviceGroupBy,
  SharedDeviceParams,
  IpClusterParams,
} from '@/types/admin-devices';

const TABS: { id: DeviceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'devices', label: 'All Devices', icon: <Monitor className="h-4 w-4" /> },
  { id: 'shared', label: 'Shared Devices', icon: <Fingerprint className="h-4 w-4" /> },
  { id: 'ip-clusters', label: 'IP Clusters', icon: <Globe className="h-4 w-4" /> },
];

function DeviceIntelligenceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab state
  const activeTab = (searchParams.get('tab') as DeviceTab) || 'devices';

  // User device history sheet
  const [sheetUser, setSheetUser] = useState<{ uuid: string; name: string } | null>(null);

  // Debounced search for devices tab
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounce(searchValue, 300);

  // ── URL param helpers ──────────────────────────────────────

  const updateParams = useCallback(
    (updates: Record<string, string | number | string[] | undefined>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          newParams.delete(key);
        } else if (Array.isArray(value)) {
          newParams.delete(key);
          value.forEach((v) => newParams.append(key, v));
        } else {
          newParams.set(key, String(value));
        }
      });
      const qs = newParams.toString();
      router.push(qs ? `/admin/device-intelligence?${qs}` : '/admin/device-intelligence');
    },
    [router, searchParams]
  );

  const switchTab = useCallback(
    (tab: DeviceTab) => {
      // Reset all tab-specific params, keep only tab
      router.push(`/admin/device-intelligence?tab=${tab}`);
      setSearchValue('');
    },
    [router]
  );

  // ── Devices tab params ─────────────────────────────────────

  const deviceParams = useMemo<DeviceListParams>(() => {
    if (activeTab !== 'devices') return {};
    return {
      page: Number(searchParams.get('page')) || 1,
      per_page: Number(searchParams.get('per_page')) || 15,
      sort_by: (searchParams.get('sort_by') as DeviceSortBy) || 'last_active_at',
      sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
      search: debouncedSearch || undefined,
      country: searchParams.get('country') || undefined,
      device_type: (searchParams.get('device_type') as DeviceListParams['device_type']) || undefined,
      browser: searchParams.get('browser') || undefined,
      platform: searchParams.get('platform') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
    };
  }, [searchParams, debouncedSearch, activeTab]);

  // ── Shared tab params ──────────────────────────────────────

  const sharedParams = useMemo<SharedDeviceParams>(() => {
    return {
      group_by: (searchParams.get('group_by') as SharedDeviceGroupBy) || 'fingerprint',
      per_page: Number(searchParams.get('per_page')) || 15,
      page: Number(searchParams.get('page')) || 1,
    };
  }, [searchParams]);

  // ── IP clusters tab params ─────────────────────────────────

  const ipClusterParams = useMemo<IpClusterParams>(() => {
    return {
      per_page: Number(searchParams.get('per_page')) || 15,
      page: Number(searchParams.get('page')) || 1,
    };
  }, [searchParams]);

  // ── Data fetching (only active tab fires) ───────────────

  const devicesQuery = useAdminDevices(deviceParams, activeTab === 'devices');
  const sharedQuery = useAdminSharedDevices(sharedParams, activeTab === 'shared');
  const ipClustersQuery = useAdminIpClusters(ipClusterParams, activeTab === 'ip-clusters');

  // ── Debounced search sync ──────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'devices') return;
    const currentSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentSearch) {
      updateParams({ search: debouncedSearch || undefined, page: 1 });
    }
  }, [debouncedSearch, searchParams, updateParams, activeTab]);

  // ── Handlers ───────────────────────────────────────────────

  const handleDeviceParamsChange = useCallback(
    (newParams: Partial<DeviceListParams>) => {
      updateParams(newParams as Record<string, string | undefined>);
    },
    [updateParams]
  );

  const handleDeviceSort = useCallback(
    (sortBy: DeviceSortBy) => {
      updateParams({
        sort_by: sortBy,
        sort_order:
          deviceParams.sort_by === sortBy && deviceParams.sort_order === 'desc'
            ? 'asc'
            : 'desc',
      });
    },
    [updateParams, deviceParams.sort_by, deviceParams.sort_order]
  );

  const handlePageChange = useCallback(
    (page: number) => updateParams({ page }),
    [updateParams]
  );

  const handlePerPageChange = useCallback(
    (perPage: number) => updateParams({ per_page: perPage, page: 1 }),
    [updateParams]
  );

  const handleViewUserDevices = useCallback(
    (userUuid: string, userName: string) => {
      setSheetUser({ uuid: userUuid, name: userName });
    },
    []
  );

  // ── Active tab pagination ──────────────────────────────────

  const activePagination =
    activeTab === 'devices'
      ? devicesQuery.data?.pagination
      : activeTab === 'shared'
        ? sharedQuery.data?.pagination
        : ipClustersQuery.data?.pagination;

  const activePerPage =
    Number(searchParams.get('per_page')) || 15;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Device Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Detect multi-accounting and suspicious activity through device fingerprints, shared devices, and IP analysis.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg w-fit">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            onClick={() => switchTab(tab.id)}
            className={cn(
              'gap-2',
              activeTab === tab.id
                ? ''
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <>
          <DeviceFilters
            params={deviceParams}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onParamsChange={handleDeviceParamsChange}
          />
          <DevicesTable
            devices={devicesQuery.data?.data || []}
            isLoading={devicesQuery.isLoading ?? true}
            params={deviceParams}
            onSort={handleDeviceSort}
            onViewUserDevices={handleViewUserDevices}
          />
        </>
      )}

      {/* Shared Devices Tab */}
      {activeTab === 'shared' && (
        <>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Group by:</span>
            <Select
              value={sharedParams.group_by}
              onValueChange={(v) =>
                updateParams({ group_by: v, page: 1 })
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fingerprint">Fingerprint</SelectItem>
                <SelectItem value="device_id">Device ID</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SharedDevicesTable
            groups={sharedQuery.data?.data || []}
            isLoading={sharedQuery.isLoading ?? true}
            onViewUserDevices={handleViewUserDevices}
          />
        </>
      )}

      {/* IP Clusters Tab */}
      {activeTab === 'ip-clusters' && (
        <IpClustersTable
          clusters={ipClustersQuery.data?.data || []}
          isLoading={ipClustersQuery.isLoading ?? true}
          onViewUserDevices={handleViewUserDevices}
        />
      )}

      {/* Pagination (shared across all tabs) */}
      {activePagination && (
        <AdminPagination
          pagination={activePagination}
          onPageChange={handlePageChange}
          perPage={activePerPage}
          onPerPageChange={handlePerPageChange}
          itemLabel={
            activeTab === 'devices'
              ? 'devices'
              : activeTab === 'shared'
                ? 'groups'
                : 'clusters'
          }
        />
      )}

      {/* User Device History Sheet */}
      <UserDeviceHistorySheet
        open={sheetUser !== null}
        onOpenChange={(open) => {
          if (!open) setSheetUser(null);
        }}
        userUuid={sheetUser?.uuid ?? null}
        userName={sheetUser?.name ?? ''}
      />
    </div>
  );
}

export default function DeviceIntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[280px]" />
          <Skeleton className="h-5 w-[450px]" />
          <div className="flex gap-1">
            <Skeleton className="h-9 w-[130px] rounded-lg" />
            <Skeleton className="h-9 w-[150px] rounded-lg" />
            <Skeleton className="h-9 w-[120px] rounded-lg" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-[280px]" />
            <Skeleton className="h-10 w-[140px]" />
            <Skeleton className="h-10 w-[140px]" />
            <Skeleton className="h-10 w-[150px]" />
          </div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </div>
      }
    >
      <DeviceIntelligenceContent />
    </Suspense>
  );
}
