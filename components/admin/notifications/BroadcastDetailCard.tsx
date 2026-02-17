'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bell,
  Users,
  BookOpen,
  BookOpenCheck,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Broadcast, BroadcastTargetType } from '@/types/notification';

/******************************************************************************
                                Types
******************************************************************************/

interface BroadcastDetailCardProps {
  broadcast: Broadcast;
}

/******************************************************************************
                                Helpers
******************************************************************************/

const targetTypeLabels: Record<BroadcastTargetType, string> = {
  all: 'All Users',
  role: 'By Role',
  users: 'Multiple Users',
  user: 'Single User',
};

function formatTargetCriteria(broadcast: Broadcast): string | null {
  if (!broadcast.target_criteria) return null;
  if (broadcast.target_type === 'role' && broadcast.target_criteria.role) {
    return `Role: ${broadcast.target_criteria.role}`;
  }
  if (broadcast.target_type === 'users' && broadcast.target_criteria.user_ids) {
    const ids = broadcast.target_criteria.user_ids as number[];
    return `${ids.length} user IDs`;
  }
  if (broadcast.target_type === 'user' && broadcast.target_criteria.user_id) {
    return `User ID: ${broadcast.target_criteria.user_id}`;
  }
  return null;
}

function getReadRatePercent(broadcast: Broadcast): number {
  if (broadcast.recipients_count === 0) return 0;
  return Math.round((broadcast.read_count / broadcast.recipients_count) * 100);
}

/******************************************************************************
                                Component
******************************************************************************/

export function BroadcastDetailCard({ broadcast }: BroadcastDetailCardProps) {
  const criteria = formatTargetCriteria(broadcast);
  const readRate = getReadRatePercent(broadcast);

  return (
    <div className="space-y-6">
      {/* Broadcast Info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">{broadcast.title}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Sent by {broadcast.admin.name} on{' '}
                {format(new Date(broadcast.created_at), 'PPP \'at\' p')}
              </p>
            </div>
            <Badge variant="secondary">
              {targetTypeLabels[broadcast.target_type]}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Message */}
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm whitespace-pre-line">{broadcast.message}</p>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {broadcast.icon && (
              <span className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                Icon: {broadcast.icon}
              </span>
            )}
            {criteria && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {criteria}
              </span>
            )}
            {broadcast.action_url && (
              <a
                href={broadcast.action_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Action URL
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Recipients</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {broadcast.recipients_count.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <BookOpenCheck className="h-4 w-4" />
            <span className="text-xs font-medium">Read</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {broadcast.read_count.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <BookOpen className="h-4 w-4" />
            <span className="text-xs font-medium">Unread</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">
            {broadcast.unread_count.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Bell className="h-4 w-4" />
            <span className="text-xs font-medium">Read Rate</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{readRate}%</p>
        </div>
      </div>
    </div>
  );
}
