'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import {
  Ban,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  CreditCard,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/utils/currency';
import { AdminSubscriptionCancelDialog } from './AdminSubscriptionCancelDialog';
import { AdminSubscriptionReactivateDialog } from './AdminSubscriptionReactivateDialog';
import type { AdminSubscriptionDetail as TSubscriptionDetail } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const STATUS_STYLES: Record<string, string> = {
  active: 'text-green-600 border-green-200 bg-green-50 dark:text-green-400 dark:border-green-900/50 dark:bg-green-950/50',
  past_due: 'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-900/50 dark:bg-orange-950/50',
  cancelled: 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/50 dark:bg-red-950/50',
  expired: 'text-muted-foreground border-border',
  trialing: 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-900/50 dark:bg-blue-950/50',
};

/******************************************************************************
                                 Types
******************************************************************************/

interface AdminSubscriptionDetailProps {
  subscription: TSubscriptionDetail;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Displays subscription detail cards.
 */
function AdminSubscriptionDetailView({ subscription }: AdminSubscriptionDetailProps) {
  const sub = subscription;
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);

  const canCancel =
    ['active', 'past_due', 'trialing'].includes(sub.status) && !sub.plan.is_free;
  const canReactivate = sub.status === 'cancelled';

  return (
    <div className="space-y-6">
      {/* Top row: Subscription + User cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Info - takes 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Subscription Details</CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    {sub.subscription_code || `ID: ${sub.id}`}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canCancel && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    <Ban className="mr-1.5 h-3.5 w-3.5" />
                    Cancel
                  </Button>
                )}
                {canReactivate && (
                  <Button
                    size="sm"
                    onClick={() => setReactivateDialogOpen(true)}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Reactivate
                  </Button>
                )}
                <Badge
                  variant="outline"
                  className={cn('text-sm capitalize', STATUS_STYLES[sub.status])}
                >
                  {sub.status_label}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-5 gap-x-6">
              <DetailField label="Plan" value={sub.plan.name} />
              <DetailField label="Amount" value={formatNaira(Number(sub.amount))} />
              <DetailField label="Interval" value={sub.plan.interval_label} />
              <DetailField
                label="Start Date"
                value={sub.start_date ? format(new Date(sub.start_date), 'MMM d, yyyy h:mm a') : '-'}
              />
              <DetailField
                label="Next Payment"
                value={
                  sub.next_payment_date
                    ? format(new Date(sub.next_payment_date), 'MMM d, yyyy h:mm a')
                    : '-'
                }
              />
              <DetailField
                label="Days Until Renewal"
                value={sub.days_until_renewal !== null ? String(sub.days_until_renewal) : '-'}
              />
              <DetailField label="Access">
                <div className="flex items-center gap-1.5">
                  {sub.has_access ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {sub.has_access ? 'Active' : 'None'}
                    {sub.is_in_grace_period && ' (grace period)'}
                  </span>
                </div>
              </DetailField>
              <DetailField label="Quantity" value={String(sub.quantity)} />
              <DetailField label="Invoice Limit" value={sub.invoice_limit === 0 ? 'Unlimited' : String(sub.invoice_limit)} />
              {sub.cancelled_at && (
                <DetailField
                  label="Cancelled At"
                  value={format(new Date(sub.cancelled_at), 'MMM d, yyyy')}
                />
              )}
              {sub.ends_at && (
                <DetailField
                  label="Ends At"
                  value={format(new Date(sub.ends_at), 'MMM d, yyyy')}
                />
              )}
            </div>

            {/* Admin-only fields */}
            {(sub.email_token || sub.authorization_code || sub.cron_expression) && (
              <div className="mt-6 pt-5 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Internal Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                  {sub.email_token && (
                    <DetailField label="Email Token">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono text-xs truncate block max-w-[200px] cursor-help">
                            {sub.email_token}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs break-all">
                          {sub.email_token}
                        </TooltipContent>
                      </Tooltip>
                    </DetailField>
                  )}
                  {sub.authorization_code && (
                    <DetailField label="Authorization Code">
                      <span className="font-mono text-xs">{sub.authorization_code}</span>
                    </DetailField>
                  )}
                  {sub.cron_expression && (
                    <DetailField label="Cron Expression">
                      <span className="font-mono text-xs">{sub.cron_expression}</span>
                    </DetailField>
                  )}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="mt-6 pt-5 border-t flex items-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Created {format(new Date(sub.created_at), 'PPpp')}
              </span>
              <span>
                Updated {format(new Date(sub.updated_at), 'PPpp')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* User Info Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Subscriber</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {sub.user.avatar_url ? (
                <img
                  src={sub.user.avatar_url}
                  alt={sub.user.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {sub.user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{sub.user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{sub.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <Badge variant="secondary" className="text-xs capitalize">
                {sub.user.role}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Dialogs */}
      <AdminSubscriptionCancelDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        subscription={sub}
      />
      <AdminSubscriptionReactivateDialog
        open={reactivateDialogOpen}
        onOpenChange={setReactivateDialogOpen}
        subscription={sub}
      />
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

export { AdminSubscriptionDetailView };
