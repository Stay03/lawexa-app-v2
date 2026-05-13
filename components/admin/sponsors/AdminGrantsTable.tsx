'use client';

import { useState } from 'react';
import { MoreHorizontal, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { AdminGrantRevokeDialog } from './AdminGrantRevokeDialog';
import type {
  AdminCampaignType,
  AdminGrant,
} from '@/types/admin-sponsors';
import { isPackGrant } from '@/types/admin-sponsors';

interface AdminGrantsTableProps {
  grants: AdminGrant[];
  isLoading: boolean;
  campaignType: AdminCampaignType;
}

const ACTIVE_BADGE =
  'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50';

export function AdminGrantsTable({
  grants,
  isLoading,
  campaignType,
}: AdminGrantsTableProps) {
  const [revokeTarget, setRevokeTarget] = useState<AdminGrant | null>(null);
  const isPackCampaign = campaignType === 'pack';

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-4 py-4">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (grants.length === 0) {
    return (
      <div className="rounded-lg border py-10">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Users className="h-7 w-7 opacity-40" />
          <p className="text-sm">No grants yet</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium">Granted</th>
                <th className="px-4 py-3 text-left font-medium">
                  {isPackCampaign ? 'Messages' : 'Ends'}
                </th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {grants.map((grant, index) => (
                <tr
                  key={grant.id}
                  className={cn(
                    'border-b last:border-b-0 transition-colors hover:bg-muted/50',
                    index % 2 === 1 && 'bg-muted/30'
                  )}
                >
                  <td className="px-4 py-3 max-w-[260px]">
                    <div className="font-medium truncate">
                      {grant.user.name || grant.user.email}
                    </div>
                    {grant.user.name && (
                      <div className="text-xs text-muted-foreground truncate">
                        {grant.user.email}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {new Date(grant.granted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground tabular-nums">
                    {isPackGrant(grant)
                      ? `${grant.pack.messages_remaining.toLocaleString()} / ${grant.pack.messages_total.toLocaleString()}`
                      : grant.subscription.ends_at
                        ? new Date(
                            grant.subscription.ends_at
                          ).toLocaleDateString()
                        : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {grant.is_active ? (
                      <Badge
                        variant="outline"
                        className={cn('text-xs', ACTIVE_BADGE)}
                      >
                        Active
                      </Badge>
                    ) : grant.revoked_at ? (
                      <Badge variant="outline" className="text-xs">
                        Revoked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        Expired
                      </Badge>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {grant.is_active && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setRevokeTarget(grant)}
                          >
                            Revoke grant
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {revokeTarget && (
        <AdminGrantRevokeDialog
          open
          onOpenChange={(next) => {
            if (!next) setRevokeTarget(null);
          }}
          grant={revokeTarget}
          campaignType={campaignType}
        />
      )}
    </>
  );
}
