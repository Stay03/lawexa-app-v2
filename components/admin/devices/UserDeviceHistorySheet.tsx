'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Monitor,
  Smartphone,
  Tablet,
  Bot,
  Globe,
  MapPin,
  Fingerprint,
  Key,
  Clock,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminUserDevices } from '@/lib/hooks/useAdminDevices';
import type { UserDeviceHistoryItem } from '@/types/admin-devices';

interface UserDeviceHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userUuid: string | null;
  userName: string;
}

const DEVICE_TYPE_ICON: Record<string, React.ReactNode> = {
  desktop: <Monitor className="h-4 w-4" />,
  mobile: <Smartphone className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
  bot: <Bot className="h-4 w-4" />,
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

function DeviceCard({ device }: { device: UserDeviceHistoryItem }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      {/* Header: Device name + type */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium truncate">{device.display_name}</h4>
          <p className="text-xs text-muted-foreground">
            {device.browser}
            {device.browser_version ? ` ${device.browser_version}` : ''}{' '}
            / {device.platform || 'Unknown'}
            {device.platform_version ? ` ${device.platform_version}` : ''}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'text-xs gap-1 capitalize shrink-0',
            DEVICE_TYPE_STYLES[device.device_type] || ''
          )}
        >
          {DEVICE_TYPE_ICON[device.device_type]}
          {device.device_type}
        </Badge>
      </div>

      {/* Details grid */}
      <div className="grid gap-2 text-sm">
        {/* IP + Location */}
        <div className="flex items-start gap-2">
          <Globe className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <span className="font-mono text-xs">{device.ip_address || '\u2014'}</span>
            {device.location && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                {device.location}
              </div>
            )}
          </div>
        </div>

        {/* Fingerprint */}
        {device.fingerprint && (
          <div className="flex items-center gap-2">
            <Fingerprint className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-xs text-muted-foreground truncate" title={device.fingerprint}>
              {device.fingerprint}
            </span>
          </div>
        )}

        {/* Device ID */}
        {device.device_id && (
          <div className="flex items-center gap-2">
            <Key className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-xs text-muted-foreground truncate" title={device.device_id}>
              {device.device_id}
            </span>
          </div>
        )}

        {/* Bottom row: sessions + dates */}
        <div className="flex items-center justify-between pt-1 border-t">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs">
              {device.active_sessions} active session{device.active_sessions !== 1 ? 's' : ''}
            </span>
            {device.active_sessions > 0 && (
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {device.last_active_at
              ? new Date(device.last_active_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Never'}
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserDeviceHistorySheet({
  open,
  onOpenChange,
  userUuid,
  userName,
}: UserDeviceHistorySheetProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAdminUserDevices(open ? userUuid : null, {
    per_page: 10,
    page,
  });

  // Reset page when opening a different user
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPage(1);
    }
    onOpenChange(newOpen);
  };

  const pagination = data?.pagination;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Device History</SheetTitle>
          <SheetDescription>{userName}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-[160px] w-full rounded-lg" />
              ))}
            </div>
          ) : data?.data.length ? (
            <>
              {/* Summary */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {pagination?.total || 0} device{(pagination?.total || 0) !== 1 ? 's' : ''} total
                </span>
              </div>

              {/* Device cards */}
              <div className="space-y-3">
                {data.data.map((device) => (
                  <DeviceCard key={device.id} device={device} />
                ))}
              </div>

              {/* Simple pagination */}
              {pagination && pagination.last_page > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.current_page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.current_page} of {pagination.last_page}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={pagination.current_page >= pagination.last_page}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              No devices found for this user.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
