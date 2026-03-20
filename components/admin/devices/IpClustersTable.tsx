'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Users,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IpCluster, DeviceUserInGroup } from '@/types/admin-devices';

interface IpClustersTableProps {
  clusters: IpCluster[];
  isLoading: boolean;
  onViewUserDevices: (userUuid: string, userName: string) => void;
}

function getUserCountSeverity(count: number): string {
  if (count >= 10)
    return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50';
  if (count >= 5)
    return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-900/50';
  if (count >= 3)
    return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/50 dark:text-yellow-400 dark:border-yellow-900/50';
  return 'bg-muted text-muted-foreground';
}

function UserRow({
  user,
  onViewDevices,
}: {
  user: DeviceUserInGroup;
  onViewDevices: () => void;
}) {
  return (
    <button
      onClick={onViewDevices}
      className="flex items-start gap-3 w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{user.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {user.role}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {user.email || 'No email'}
        </div>
        {(user.university || user.profession) && (
          <div className="text-xs text-muted-foreground mt-0.5">
            {[user.profession, user.university, user.law_school]
              .filter(Boolean)
              .join(' \u2022 ')}
          </div>
        )}
      </div>
    </button>
  );
}

function IpClusterRow({
  cluster,
  onViewUserDevices,
}: {
  cluster: IpCluster;
  onViewUserDevices: (userUuid: string, userName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const location = [cluster.ip_city, cluster.ip_region, cluster.ip_country]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-[30px]">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell>
          <span className="font-mono text-sm">{cluster.ip_address}</span>
        </TableCell>
        <TableCell className="max-w-[200px]">
          {location ? (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm truncate" title={location}>
                {location}
              </span>
              {cluster.ip_country_code && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                  {cluster.ip_country_code}
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">\u2014</span>
          )}
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn('text-xs font-semibold gap-1', getUserCountSeverity(cluster.user_count))}
          >
            {cluster.user_count >= 5 && <AlertTriangle className="h-3 w-3" />}
            <Users className="h-3 w-3" />
            {cluster.user_count}
          </Badge>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/30 p-0">
            <div className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Users ({cluster.users.length})
              </h4>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {cluster.users.map((user) => (
                  <UserRow
                    key={user.uuid}
                    user={user}
                    onViewDevices={() => onViewUserDevices(user.uuid, user.name)}
                  />
                ))}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function IpClustersTable({
  clusters,
  isLoading,
  onViewUserDevices,
}: IpClustersTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!clusters.length) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No IP clusters found.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]" />
            <TableHead>IP Address</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Users</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clusters.map((cluster) => (
            <IpClusterRow
              key={cluster.ip_address}
              cluster={cluster}
              onViewUserDevices={onViewUserDevices}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
