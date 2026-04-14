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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeviceAbuseLog, DeviceAbuseLogUser } from '@/types/admin-devices';

interface AbuseLogsTableProps {
  logs: DeviceAbuseLog[];
  isLoading: boolean;
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ExistingUserRow({ user }: { user: DeviceAbuseLogUser }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded-md">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{user.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {user.role}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground truncate">{user.email}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Registered {formatDate(user.created_at)}
        </div>
      </div>
    </div>
  );
}

function AbuseLogRow({ log }: { log: DeviceAbuseLog }) {
  const [expanded, setExpanded] = useState(false);

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
          <div>
            <div className="text-sm font-medium">{log.blocked_user.name}</div>
            <div className="text-xs text-muted-foreground">{log.blocked_user.email}</div>
          </div>
        </TableCell>
        <TableCell>
          <span className="font-mono text-xs break-all">{log.device_id}</span>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-semibold gap-1',
              getUserCountSeverity(log.existing_users.length)
            )}
          >
            {log.existing_users.length >= 5 && (
              <AlertTriangle className="h-3 w-3" />
            )}
            <Users className="h-3 w-3" />
            {log.existing_users.length}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="text-xs capitalize">
            {log.metadata.auth_provider}
          </Badge>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
          {formatDate(log.created_at)}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-0">
            <div className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Existing Users on Device ({log.existing_users.length})
              </h4>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {log.existing_users.map((user) => (
                  <ExistingUserRow key={user.uuid} user={user} />
                ))}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function AbuseLogsTable({ logs, isLoading }: AbuseLogsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!logs.length) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No abuse logs found.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]" />
            <TableHead>Blocked User</TableHead>
            <TableHead>Device ID</TableHead>
            <TableHead>Existing Users</TableHead>
            <TableHead>Auth Provider</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <AbuseLogRow key={log.id} log={log} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
