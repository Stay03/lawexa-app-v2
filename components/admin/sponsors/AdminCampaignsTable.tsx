'use client';

import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type {
  AdminCampaign,
  AdminCampaignStatus,
} from '@/types/admin-sponsors';

const STATUS_STYLES: Record<AdminCampaignStatus, string> = {
  draft:
    'text-muted-foreground border-border bg-muted/40',
  active:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  ended:
    'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900/50 dark:bg-amber-950/50',
};

interface AdminCampaignsTableProps {
  campaigns: AdminCampaign[];
  isLoading: boolean;
}

export function AdminCampaignsTable({
  campaigns,
  isLoading,
}: AdminCampaignsTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="divide-y divide-border">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="px-4 py-4">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border py-10">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Megaphone className="h-7 w-7 opacity-40" />
          <p className="text-sm">No campaigns yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-medium">Campaign</th>
              <th className="px-4 py-3 text-left font-medium">Type</th>
              <th className="px-4 py-3 text-left font-medium">Grants</th>
              <th className="px-4 py-3 text-right font-medium">Cap</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign, index) => (
              <tr
                key={campaign.id}
                className={cn(
                  'border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50',
                  index % 2 === 1 && 'bg-muted/30'
                )}
                onClick={() => router.push(`/admin/campaigns/${campaign.id}`)}
              >
                <td className="px-4 py-3 max-w-[260px]">
                  <div className="font-medium truncate">{campaign.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {campaign.slug}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">
                    {campaign.type_label}
                  </Badge>
                </td>
                <td className="px-4 py-3 max-w-[260px]">
                  {campaign.type === 'plan' ? (
                    <>
                      <div className="truncate">
                        {campaign.plan.name}
                        <span className="ml-1 text-muted-foreground tabular-nums">
                          · {campaign.duration_days}d
                        </span>
                      </div>
                      {campaign.plan.is_internal && (
                        <span className="text-xs text-muted-foreground">
                          Internal sponsor plan
                        </span>
                      )}
                    </>
                  ) : (
                    <div className="truncate tabular-nums">
                      {campaign.pack_size.toLocaleString()} messages
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                  {campaign.max_grants ?? '∞'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge
                    variant="outline"
                    className={cn('text-xs', STATUS_STYLES[campaign.status])}
                  >
                    {campaign.status_label}
                  </Badge>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {new Date(campaign.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
