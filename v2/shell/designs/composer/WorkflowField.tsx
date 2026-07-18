'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { workflowsQueries } from '@/v2/features/workflows/queries';
import type { AdminAiWorkflowsParams } from '@/types/admin-ai';
import type { UserRole } from '@/types/auth';

/**
 * WorkflowField — the composer's role-aware workflow selector, faithful to v1's
 * two paths (studied in `app/(main)/page.tsx`):
 *
 *  - Regular signed-in users (incl. researchers) → the fixed `USER_WORKFLOWS`
 *    (Lawexa Lite id 15 / Lawexa Expert id 16). No fetch.
 *  - admin / superadmin → the full API list from `/admin/ai-workflows`
 *    (active_only, per_page 50), defaulting to the workflow flagged `is_default`
 *    (else the first). While that loads, a skeleton chip holds the space and
 *    cross-fades to the Select (skeleton-first rule).
 *
 * Selection is LOCAL this wave (wiring the chosen workflow into the send payload
 * is chat-wave work). The default is derived, and a user pick is held in
 * `override`, so the effective value is `override ?? default` — no setState in an
 * effect (React Compiler lint).
 */

/** v1's `USER_WORKFLOWS` — the non-admin Lite / Expert choice. */
const USER_WORKFLOWS = [
  { id: '15', label: 'Lawexa Lite' },
  { id: '16', label: 'Lawexa Expert' },
] as const;
const DEFAULT_USER_WORKFLOW_ID = '15';

/** v1's admin fetch params: active workflows only, one page deep enough for all. */
const ADMIN_PARAMS: AdminAiWorkflowsParams = { active_only: true, per_page: 50 };

const TRIGGER_CLASS =
  'v2-interactive h-8 shrink-0 gap-1 rounded-full border-none bg-transparent px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&>span]:truncate';

interface WorkflowFieldProps {
  role: UserRole | undefined;
  disabled?: boolean;
  /** Keep clicks inside portaled content from bubbling to PromptInput's root. */
  stop: (event: React.SyntheticEvent) => void;
}

export function WorkflowField({ role, disabled, stop }: WorkflowFieldProps) {
  const isAdmin = role === 'admin' || role === 'superadmin';

  const workflowsQuery = useQuery({
    ...workflowsQueries.list(ADMIN_PARAMS),
    enabled: isAdmin,
  });

  // Options + the derived default, per role.
  const options = useMemo(() => {
    if (!isAdmin) return USER_WORKFLOWS.map((w) => ({ id: w.id, label: w.label }));
    return (workflowsQuery.data?.data ?? []).map((w) => ({
      id: String(w.id),
      label: w.name,
    }));
  }, [isAdmin, workflowsQuery.data]);

  const defaultId = useMemo(() => {
    if (!isAdmin) return DEFAULT_USER_WORKFLOW_ID;
    const list = workflowsQuery.data?.data ?? [];
    const preferred = list.find((w) => w.is_default) ?? list[0];
    return preferred ? String(preferred.id) : '';
  }, [isAdmin, workflowsQuery.data]);

  const [override, setOverride] = useState<string | null>(null);
  // Reset the override if it no longer matches a loaded option (e.g. the admin
  // list arrives) — derived, so it never needs an effect.
  const value =
    override && options.some((o) => o.id === override) ? override : defaultId;

  // Admin list still loading → a skeleton chip in place of the Select.
  if (isAdmin && workflowsQuery.isPending) {
    return <Skeleton className="h-8 w-24 shrink-0 rounded-full" />;
  }

  // Admin with an empty (loaded) catalogue → nothing to select (v1 hides it).
  if (options.length === 0) return null;

  return (
    <div className="shrink-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      <Select value={value} onValueChange={setOverride} disabled={disabled}>
        <SelectTrigger
          size="sm"
          onClick={stop}
          aria-label="Workflow"
          className={cn(TRIGGER_CLASS, 'max-w-[9rem]')}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent onClick={stop}>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
