'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowUpDown,
  MoreHorizontal,
  Monitor,
  Smartphone,
  Tablet,
  Bot,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeviceListItem, DeviceListParams, DeviceSortBy } from '@/types/admin-devices';

interface DevicesTableProps {
  devices: DeviceListItem[];
  isLoading: boolean;
  params: DeviceListParams;
  onSort: (sortBy: DeviceSortBy) => void;
  onViewUserDevices: (userUuid: string, userName: string) => void;
}

const DEVICE_TYPE_ICON: Record<string, React.ReactNode> = {
  desktop: <Monitor className="h-3.5 w-3.5" />,
  mobile: <Smartphone className="h-3.5 w-3.5" />,
  tablet: <Tablet className="h-3.5 w-3.5" />,
  bot: <Bot className="h-3.5 w-3.5" />,
};

const DEVICE_TYPE_STYLES: Record<string, string> = {
  desktop:
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/50',
  mobile:
    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900/50',
  tablet:
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-900/50',
  bot: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-900/50',
};

function SortableHead({
  children,
  sortKey,
  currentSort,
  currentOrder,
  onSort,
}: {
  children: React.ReactNode;
  sortKey: DeviceSortBy;
  currentSort?: string;
  currentOrder?: string;
  onSort: (sortBy: DeviceSortBy) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <TableHead>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {children}
        <ArrowUpDown
          className={cn(
            'h-3.5 w-3.5',
            isActive ? 'text-foreground' : 'text-muted-foreground/50'
          )}
        />
        {isActive && (
          <span className="text-xs text-muted-foreground">
            {currentOrder === 'asc' ? '\u2191' : '\u2193'}
          </span>
        )}
      </button>
    </TableHead>
  );
}

function truncate(str: string | null, len: number): string {
  if (!str) return '\u2014';
  return str.length > len ? str.slice(0, len) + '\u2026' : str;
}

export function DevicesTable({
  devices,
  isLoading,
  params,
  onSort,
  onViewUserDevices,
}: DevicesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!devices.length) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No devices found matching your filters.
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>IP / Location</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Fingerprint</TableHead>
              <SortableHead
                sortKey="last_active_at"
                currentSort={params.sort_by}
                currentOrder={params.sort_order}
                onSort={onSort}
              >
                Last Active
              </SortableHead>
              <SortableHead
                sortKey="created_at"
                currentSort={params.sort_by}
                currentOrder={params.sort_order}
                onSort={onSort}
              >
                Created
              </SortableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow key={device.id}>
                <TableCell className="max-w-[180px]">
                  <div className="font-medium text-sm truncate" title={device.display_name}>
                    {device.display_name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {device.browser}
                    {device.browser_version ? ` ${device.browser_version}` : ''}{' '}
                    / {device.platform || 'Unknown'}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs gap-1 capitalize',
                      DEVICE_TYPE_STYLES[device.device_type] || ''
                    )}
                  >
                    {DEVICE_TYPE_ICON[device.device_type]}
                    {device.device_type}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <div className="text-sm font-mono truncate" title={device.ip_address || undefined}>
                    {device.ip_address || '\u2014'}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={device.location || undefined}>
                    {device.location || '\u2014'}
                  </div>
                </TableCell>
                <TableCell className="max-w-[150px]">
                  {device.user ? (
                    <div>
                      <div className="text-sm font-medium truncate" title={device.user.name}>
                        {device.user.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate" title={device.user.email}>
                        {device.user.email}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">\u2014</span>
                  )}
                </TableCell>
                <TableCell>
                  {device.fingerprint ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs font-mono cursor-help text-muted-foreground">
                          {truncate(device.fingerprint, 10)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-mono text-xs">{device.fingerprint}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground text-xs">\u2014</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums text-sm whitespace-nowrap">
                  {device.last_active_at
                    ? new Date(device.last_active_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '\u2014'}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums text-sm whitespace-nowrap">
                  {device.created_at
                    ? new Date(device.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '\u2014'}
                </TableCell>
                <TableCell>
                  {device.user && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            onViewUserDevices(device.user!.uuid, device.user!.name)
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View User Devices
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
