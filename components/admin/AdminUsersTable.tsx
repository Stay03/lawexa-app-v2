'use client';

import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import {
  ArrowUpDown,
  Mail,
  Chrome,
  Users,
  Infinity,
  ShieldCheck,
  BadgeCheck,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  IAdminUserListItem,
  IAdminUserListParams,
  TAdminUserSortBy,
} from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const ROLE_BADGE_VARIANT: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  superadmin: 'destructive',
  admin: 'default',
  researcher: 'secondary',
  user: 'outline',
  guest: 'outline',
  bot: 'outline',
};

/******************************************************************************
                                 Types
******************************************************************************/

interface IAdminUsersTableProps {
  users: IAdminUserListItem[];
  isLoading: boolean;
  params: IAdminUserListParams;
  onSort: (sortBy: TAdminUserSortBy) => void;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Render the admin users table with sortable columns.
 */
function AdminUsersTable({
  users,
  isLoading,
  params,
  onSort,
}: IAdminUsersTableProps) {
  const router = useRouter();

  const handleRowClick = (uuid: string) => {
    router.push(`/admin/users/${uuid}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3">
          <Skeleton className="h-5 w-full max-w-[600px]" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-4 flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-[180px]" />
                <Skeleton className="h-3 w-[120px]" />
              </div>
              <Skeleton className="h-5 w-[60px]" />
              <Skeleton className="h-4 w-[50px]" />
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[40px]" />
              <Skeleton className="h-4 w-[70px]" />
              <Skeleton className="h-4 w-[70px]" />
              <Skeleton className="h-4 w-[70px]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (users.length === 0) {
    return (
      <div className="rounded-lg border py-12">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Users className="h-8 w-8 opacity-40" />
          <p className="text-sm">No users found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[280px] font-semibold">
              <SortButton field="name" params={params} onSort={onSort}>
                User
              </SortButton>
            </TableHead>
            <TableHead className="w-[100px] font-semibold">
              <SortButton field="role" params={params} onSort={onSort}>
                Role
              </SortButton>
            </TableHead>
            <TableHead className="w-[60px] font-semibold">Auth</TableHead>
            <TableHead className="w-[100px] font-semibold">Plan</TableHead>
            <TableHead className="w-[90px] text-right font-semibold">Messages</TableHead>
            <TableHead className="w-[100px] font-semibold">Country</TableHead>
            <TableHead className="w-[120px] font-semibold">
              <SortButton field="last_seen_at" params={params} onSort={onSort}>
                Last Seen
              </SortButton>
            </TableHead>
            <TableHead className="w-[120px] font-semibold">
              <SortButton field="created_at" params={params} onSort={onSort}>
                Joined
              </SortButton>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user, index) => (
            <TableRow
              key={user.uuid}
              className={cn(
                'cursor-pointer transition-colors hover:bg-muted/40',
                index % 2 === 1 && 'bg-muted/30'
              )}
              onClick={() => handleRowClick(user.uuid)}
            >
              {/* User */}
              <TableCell className="max-w-[280px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.name}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground">
                            {_getInitials(user.name)}
                          </div>
                        )}
                        {user.is_online && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="block truncate font-medium text-sm">
                            {user.name}
                          </span>
                          {user.is_verified && (
                            <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                          )}
                          {user.is_creator && (
                            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email || 'No email'}
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[280px]">
                    <div className="space-y-1 text-xs">
                      {user.profession && <p>Profession: {user.profession}</p>}
                      {user.university && <p>University: {user.university}</p>}
                      {user.area_of_study && <p>Study: {user.area_of_study}</p>}
                      {!user.profession && !user.university && !user.area_of_study && (
                        <p className="text-muted-foreground">No profile info</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TableCell>

              {/* Role */}
              <TableCell>
                <Badge variant={ROLE_BADGE_VARIANT[user.role] || 'outline'} className="capitalize text-xs">
                  {user.role}
                </Badge>
              </TableCell>

              {/* Auth */}
              <TableCell>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {user.auth_provider === 'google' ? (
                    <Chrome className="h-3.5 w-3.5" />
                  ) : (
                    <Mail className="h-3.5 w-3.5" />
                  )}
                  <span className="capitalize">{user.auth_provider}</span>
                </span>
              </TableCell>

              {/* Plan */}
              <TableCell className="text-sm">
                <span className="block truncate max-w-[100px]">
                  {user.subscription_plan || '—'}
                </span>
              </TableCell>

              {/* Messages */}
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1.5">
                  {user.remaining_messages === null ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground cursor-help">
                          <Infinity className="h-4 w-4" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">Unlimited messages</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span
                      className={cn(
                        'tabular-nums text-sm',
                        user.remaining_messages === 0 && 'text-destructive font-medium'
                      )}
                    >
                      {user.remaining_messages}
                    </span>
                  )}
                  {user.has_payg_balance && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 cursor-help">
                          PAYG
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p className="text-xs">{user.payg_balance} PAYG messages remaining</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TableCell>

              {/* Country */}
              <TableCell className="text-sm">
                <span className="block truncate max-w-[100px]">
                  {user.country || '—'}
                </span>
              </TableCell>

              {/* Last Seen */}
              <TableCell>
                {user.is_online ? (
                  <span className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Online
                  </span>
                ) : user.last_seen_at ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-muted-foreground text-sm cursor-help">
                        {formatDistanceToNow(new Date(user.last_seen_at), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <div className="space-y-1 text-xs">
                        <p>{format(new Date(user.last_seen_at), 'PPpp')}</p>
                        {(user.device_type || user.platform) && (
                          <p className="text-muted-foreground">
                            {[user.device_type, user.platform].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {user.ip_address && (
                          <p className="text-muted-foreground font-mono">{user.ip_address}</p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>

              {/* Joined */}
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground text-sm cursor-help">
                      {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{format(new Date(user.created_at), 'PPpp')}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/******************************************************************************
                                 Sub-components
******************************************************************************/

/**
 * Sort button for table headers.
 */
function SortButton({
  field,
  params,
  onSort,
  children,
}: {
  field: TAdminUserSortBy;
  params: IAdminUserListParams;
  onSort: (sortBy: TAdminUserSortBy) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => onSort(field)}
    >
      {children}
      <ArrowUpDown
        className={cn('ml-2 h-4 w-4', params.sort_by === field && 'text-primary')}
      />
    </Button>
  );
}

/******************************************************************************
                                 Functions
******************************************************************************/

/**
 * Get user initials from name.
 */
function _getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/******************************************************************************
                                 Export default
******************************************************************************/

export { AdminUsersTable };
