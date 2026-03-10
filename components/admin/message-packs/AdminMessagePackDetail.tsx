'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import {
  Clock,
  User,
  Package,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/utils/currency';
import type { AdminMessagePackDetail as TMessagePackDetail } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const STATUS_STYLES: Record<string, string> = {
  completed: 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  pending: 'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50',
  failed: 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50',
  refunded: 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
};

/******************************************************************************
                                 Types
******************************************************************************/

interface AdminMessagePackDetailProps {
  messagePack: TMessagePackDetail;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Displays message pack detail cards.
 */
function AdminMessagePackDetailView({ messagePack }: AdminMessagePackDetailProps) {
  const pack = messagePack;

  return (
    <div className="space-y-6">
      {/* Top row: Pack Details + Buyer card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pack Info - takes 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Pack Details</CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    ID: {pack.id}
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant="outline"
                className={cn('text-sm capitalize', STATUS_STYLES[pack.status])}
              >
                {pack.status_label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6">
              <DetailField label="Quantity" value={String(pack.quantity)} />
              <DetailField label="Messages Total" value={pack.messages_total.toLocaleString()} />
              <DetailField label="Messages Consumed" value={pack.messages_consumed.toLocaleString()} />
              <DetailField label="Messages Remaining" value={pack.messages_remaining.toLocaleString()} />
              <DetailField label="Amount" value={formatNaira(pack.amount)} />
              <DetailField label="Currency" value={pack.currency} />
              {pack.paid_at && (
                <DetailField
                  label="Paid At"
                  value={format(new Date(pack.paid_at), 'MMM d, yyyy h:mm a')}
                />
              )}
            </div>

            {/* Transaction Details */}
            {(pack.transaction_reference || pack.metadata) && (
              <div className="mt-6 pt-5 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Transaction Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                  {pack.transaction_reference && (
                    <DetailField label="Transaction Reference">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono text-xs truncate block max-w-[240px] cursor-help">
                            {pack.transaction_reference}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs break-all">
                          {pack.transaction_reference}
                        </TooltipContent>
                      </Tooltip>
                    </DetailField>
                  )}
                  {pack.metadata && Object.entries(pack.metadata).map(([key, value]) => (
                    <DetailField key={key} label={key.replace(/_/g, ' ')}>
                      <span className="text-sm font-medium capitalize">
                        {String(value)}
                      </span>
                    </DetailField>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="mt-6 pt-5 border-t flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Created {format(new Date(pack.created_at), 'PPpp')}
              </span>
              <span>
                Updated {format(new Date(pack.updated_at), 'PPpp')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Buyer Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Buyer</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {pack.user.avatar_url ? (
                <img
                  src={pack.user.avatar_url}
                  alt={pack.user.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {pack.user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{pack.user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{pack.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs capitalize">
                {pack.user.role}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/******************************************************************************
                                 Functions
******************************************************************************/

/** Reusable label/value pair for detail fields. */
function DetailField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      {children ?? <p className="text-sm font-medium">{value}</p>}
    </div>
  );
}

export { AdminMessagePackDetailView };
