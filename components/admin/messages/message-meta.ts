import type { MessageRole, MessageSentVia } from '@/types/admin-messages';

export const SENT_VIA_LABEL: Record<MessageSentVia, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  researcher: 'Researcher',
  system: 'System',
  plan_paid: 'Paid plan',
  plan_trial: 'Trial plan',
  plan_free: 'Free plan',
  plan_granted: 'Granted plan',
  pack: 'Pack',
  pack_granted: 'Granted pack',
};

/**
 * Tone classes per tier. Bypass tiers are neutral; paid tiers green; trial
 * amber; free muted; granted (sponsor-funded) violet to flag for billing eyes;
 * pack tiers blue.
 */
export const SENT_VIA_TONE: Record<MessageSentVia, string> = {
  super_admin:
    'text-slate-700 border-slate-200 bg-slate-50 dark:text-slate-300 dark:border-slate-800 dark:bg-slate-950/40',
  admin:
    'text-slate-700 border-slate-200 bg-slate-50 dark:text-slate-300 dark:border-slate-800 dark:bg-slate-950/40',
  researcher:
    'text-slate-700 border-slate-200 bg-slate-50 dark:text-slate-300 dark:border-slate-800 dark:bg-slate-950/40',
  system:
    'text-slate-700 border-slate-200 bg-slate-50 dark:text-slate-300 dark:border-slate-800 dark:bg-slate-950/40',
  plan_paid:
    'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900/50 dark:bg-emerald-950/40',
  plan_trial:
    'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-900/50 dark:bg-amber-950/40',
  plan_free:
    'text-muted-foreground border-border bg-muted/40',
  plan_granted:
    'text-violet-700 border-violet-200 bg-violet-50 dark:text-violet-300 dark:border-violet-900/50 dark:bg-violet-950/40',
  pack:
    'text-sky-700 border-sky-200 bg-sky-50 dark:text-sky-300 dark:border-sky-900/50 dark:bg-sky-950/40',
  pack_granted:
    'text-violet-700 border-violet-200 bg-violet-50 dark:text-violet-300 dark:border-violet-900/50 dark:bg-violet-950/40',
};

export const ROLE_LABEL: Record<MessageRole, string> = {
  user: 'User',
  assistant: 'Assistant',
  tool: 'Tool',
};

export const ROLE_TONE: Record<MessageRole, string> = {
  user: 'text-foreground border-border bg-muted/40',
  assistant:
    'text-indigo-700 border-indigo-200 bg-indigo-50 dark:text-indigo-300 dark:border-indigo-900/50 dark:bg-indigo-950/40',
  tool:
    'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-900/50 dark:bg-amber-950/40',
};

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
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

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function truncate(s: string, max = 140): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}
