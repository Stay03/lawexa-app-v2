'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Phone,
  Mail,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Shield,
  ExternalLink,
  CalendarDays,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LawyerConnectionRequest } from '@/types/connection';
import type { LawyerConnectStatus } from '@/types/admin-lawyer-connect';

interface LawyerConnectDetailCardProps {
  request: LawyerConnectionRequest;
}

function StatusBadge({ status }: { status: LawyerConnectStatus }) {
  const config = {
    pending: {
      label: 'Pending',
      icon: Clock,
      className:
        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/50',
    },
    accepted: {
      label: 'Accepted',
      icon: CheckCircle2,
      className:
        'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-900/50',
    },
    rejected: {
      label: 'Rejected',
      icon: XCircle,
      className:
        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/50',
    },
  };
  const { label, icon: Icon, className } = config[status] ?? config.pending;
  return (
    <Badge variant="outline" className={cn('gap-1.5 text-sm font-medium px-3 py-1', className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
}

function UserCard({
  user,
  role,
}: {
  user: LawyerConnectionRequest['user'];
  role: 'Client' | 'Lawyer';
}) {
  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {role}
      </p>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground">
          {initials}
        </div>
        <div className="min-w-0 space-y-1">
          <Link
            href={`/admin/users/${user.uuid}`}
            className="font-semibold text-sm hover:underline hover:text-primary transition-colors flex items-center gap-1"
          >
            {user.name}
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Link>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs capitalize">
              {user.role}
            </Badge>
            {user.is_verified ? (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <ShieldCheck className="h-3 w-3" />
                Verified
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Shield className="h-3 w-3" />
                Unverified
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            Joined {format(new Date(user.created_at), 'MMM d, yyyy')}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LawyerConnectDetailCard({ request }: LawyerConnectDetailCardProps) {
  return (
    <div className="space-y-6">
      {/* Header: Status + ID + Timestamps */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">
                Request #{request.id}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Submitted{' '}
                {format(new Date(request.created_at), 'PPpp')}
              </p>
            </div>
            <StatusBadge status={request.status} />
          </div>
        </CardHeader>
        <CardContent>
          {request.responded_at && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Responded on{' '}
              {format(new Date(request.responded_at), 'PPpp')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Parties: Client & Lawyer */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <UserCard user={request.user} role="Client" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <UserCard user={request.lawyer} role="Lawyer" />
              <Button asChild variant="outline" size="sm" className="w-full gap-1.5">
                <Link href={`/admin/lawyer-connect/lawyer/${request.lawyer.uuid}`}>
                  View all requests for this lawyer
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Contact Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {request.phone_number ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Phone Number
                </p>
                <p className="text-sm">{request.phone_number}</p>
              </div>
            ) : null}
            {request.contact_email ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Contact Email
                </p>
                <p className="text-sm">{request.contact_email}</p>
              </div>
            ) : null}
            {!request.phone_number && !request.contact_email && (
              <p className="text-sm text-muted-foreground col-span-2">
                No contact details provided.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Message */}
      {request.message && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Message
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {request.message}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
