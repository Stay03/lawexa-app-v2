'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { getActionMeta, TONE_CLASS } from './action-meta';
import type { ActivityFeedRow as ActivityFeedRowType } from '@/types/admin-activity';

interface ActivityFeedRowProps {
  row: ActivityFeedRowType;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function subjectLabel(subject: ActivityFeedRowType['subject']): string | null {
  if (!subject) return null;
  const type = subject.type.split('\\').pop() ?? subject.type;
  return `${type} #${subject.id}`;
}

function propertyHint(action: string, properties: Record<string, unknown>): string | null {
  if (!properties || Object.keys(properties).length === 0) return null;
  switch (action) {
    case 'login_failed':
      return typeof properties.email === 'string' ? `email: ${properties.email}` : null;
    case 'ai_message_sent':
      return typeof properties.has_attachment === 'boolean'
        ? `attachment: ${properties.has_attachment ? 'yes' : 'no'}`
        : null;
    case 'note_created':
      return typeof properties.status === 'string' ? properties.status : null;
    case 'note_exported':
      return typeof properties.format === 'string' ? properties.format.toUpperCase() : null;
    case 'content_requested':
      return typeof properties.type === 'string' ? properties.type : null;
    case 'subscription_started':
    case 'subscription_cancelled':
      return typeof properties.plan_id === 'number' ? `plan #${properties.plan_id}` : null;
    case 'message_pack_purchased':
      return typeof properties.messages === 'number' ? `${properties.messages} msgs` : null;
    default:
      return null;
  }
}

export function ActivityFeedRow({ row }: ActivityFeedRowProps) {
  const meta = getActionMeta(row.action);
  const Icon = meta.icon;
  const subject = subjectLabel(row.subject);
  const hint = propertyHint(row.action, row.properties);
  const failed = row.status === 'failed';

  const actorHref = row.user ? `/admin/users/${row.user.uuid}` : null;
  const actorName = row.user?.name || row.user?.email || (row.bot.is_bot ? row.bot.name || 'Bot' : 'Anonymous');

  return (
    <div className="flex gap-3 border-b py-3 last:border-b-0">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE_CLASS[meta.tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          {actorHref ? (
            <Link
              href={actorHref}
              className="font-medium hover:underline truncate max-w-[200px]"
            >
              {actorName}
            </Link>
          ) : (
            <span className="font-medium text-muted-foreground truncate max-w-[200px]">
              {actorName}
            </span>
          )}
          <span className="text-muted-foreground">{meta.label}</span>
          {subject && (
            <span className="text-muted-foreground">
              — <span className="font-mono text-xs">{subject}</span>
            </span>
          )}
          {failed && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
              failed
            </Badge>
          )}
          {row.bot.is_bot && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              bot
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <time dateTime={row.created_at} title={new Date(row.created_at).toLocaleString()}>
            {formatRelativeTime(row.created_at)}
          </time>
          {hint && <span>• {hint}</span>}
          {row.ip.country_code && <span>• {row.ip.country_code}</span>}
          {row.ip.city && <span>{row.ip.city}</span>}
          {row.device.browser && row.device.platform && (
            <span>• {row.device.browser} / {row.device.platform}</span>
          )}
        </div>
      </div>
    </div>
  );
}
