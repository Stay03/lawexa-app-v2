'use client';

import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { AdminSponsor } from '@/types/admin-sponsors';

const STATUS_STYLES = {
  active:
    'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  inactive: 'text-muted-foreground border-border',
};

interface AdminSponsorsTableProps {
  sponsors: AdminSponsor[];
  isLoading: boolean;
}

export function AdminSponsorsTable({
  sponsors,
  isLoading,
}: AdminSponsorsTableProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="bg-muted/40 px-4 py-3">
          <Skeleton className="h-5 w-full max-w-[600px]" />
        </div>
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

  if (sponsors.length === 0) {
    return (
      <div className="rounded-lg border py-12">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Building2 className="h-8 w-8 opacity-40" />
          <p className="text-sm">No sponsors found</p>
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
              <th className="px-4 py-3 text-left font-medium">Sponsor</th>
              <th className="px-4 py-3 text-left font-medium">Contact</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Campaigns</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {sponsors.map((sponsor, index) => (
              <tr
                key={sponsor.id}
                className={cn(
                  'border-b last:border-b-0 cursor-pointer transition-colors hover:bg-muted/50',
                  index % 2 === 1 && 'bg-muted/30'
                )}
                onClick={() => router.push(`/admin/sponsors/${sponsor.id}`)}
              >
                <td className="px-4 py-3 max-w-[280px]">
                  <div className="font-medium truncate">{sponsor.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {sponsor.slug}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[260px]">
                  {sponsor.contact_email ? (
                    <div className="truncate">{sponsor.contact_email}</div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {sponsor.contact_name && (
                    <div className="text-xs text-muted-foreground truncate">
                      {sponsor.contact_name}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      sponsor.is_active
                        ? STATUS_STYLES.active
                        : STATUS_STYLES.inactive
                    )}
                  >
                    {sponsor.is_active ? (
                      <>
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Active
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-1 h-3 w-3" />
                        Inactive
                      </>
                    )}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {sponsor.campaigns_count}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {new Date(sponsor.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
