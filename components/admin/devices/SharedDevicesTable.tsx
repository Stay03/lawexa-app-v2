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
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Users,
  Globe,
  Fingerprint,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SharedDeviceGroup, DeviceUserInGroup } from '@/types/admin-devices';

interface SharedDevicesTableProps {
  groups: SharedDeviceGroup[];
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

function truncateId(str: string, len = 12): string {
  return str.length > len ? str.slice(0, len) + '\u2026' : str;
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

function SharedDeviceGroupRow({
  group,
  onViewUserDevices,
}: {
  group: SharedDeviceGroup;
  onViewUserDevices: (userUuid: string, userName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isFingerprint = group.group_by === 'fingerprint';

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
          <div className="flex items-center gap-2">
            {isFingerprint ? (
              <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Smartphone className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-mono text-sm cursor-help">
                    {truncateId(group.identifier, 16)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono text-xs">{group.identifier}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={cn('text-xs font-semibold gap-1', getUserCountSeverity(group.user_count))}
          >
            {group.user_count >= 5 && <AlertTriangle className="h-3 w-3" />}
            <Users className="h-3 w-3" />
            {group.user_count}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Globe className="h-3 w-3 shrink-0" />
            <span>{group.ip_addresses.length} IP{group.ip_addresses.length !== 1 ? 's' : ''}</span>
          </div>
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {group.cross_identifiers.length > 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    {group.cross_identifiers.length} {isFingerprint ? 'device ID' : 'fingerprint'}
                    {group.cross_identifiers.length !== 1 ? 's' : ''}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1">
                    {group.cross_identifiers.map((id) => (
                      <p key={id} className="font-mono text-xs">
                        {id}
                      </p>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            '\u2014'
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 p-0">
            <div className="p-4 space-y-3">
              {/* Users */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Users ({group.users.length})
                </h4>
                <div className="grid gap-1 sm:grid-cols-2">
                  {group.users.map((user) => (
                    <UserRow
                      key={user.uuid}
                      user={user}
                      onViewDevices={() => onViewUserDevices(user.uuid, user.name)}
                    />
                  ))}
                </div>
              </div>

              {/* IP Addresses */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  IP Addresses ({group.ip_addresses.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {group.ip_addresses.map((ip) => (
                    <Badge key={ip} variant="outline" className="font-mono text-xs">
                      {ip}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function SharedDevicesTable({
  groups,
  isLoading,
  onViewUserDevices,
}: SharedDevicesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className="rounded-lg border py-12 text-center text-muted-foreground">
        No shared devices found.
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30px]" />
            <TableHead>Identifier</TableHead>
            <TableHead>Users</TableHead>
            <TableHead>IPs</TableHead>
            <TableHead>Cross References</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <SharedDeviceGroupRow
              key={group.identifier}
              group={group}
              onViewUserDevices={onViewUserDevices}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
