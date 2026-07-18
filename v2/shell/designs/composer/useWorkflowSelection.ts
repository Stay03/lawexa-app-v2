'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { workflowsQueries } from '@/v2/features/workflows/queries';
import type { AdminAiWorkflowsParams } from '@/types/admin-ai';
import type { UserRole } from '@/types/auth';

/**
 * useWorkflowSelection — the composer's role-aware workflow state, extracted from
 * `WorkflowField` so the value it resolves is available to the SUBMIT payload
 * (`workflow_id`) as well as the selector UI. Faithful to v1's two paths
 * (`app/(main)/page.tsx`):
 *
 *  - Regular signed-in users (incl. researchers) → the fixed Lite (15) / Expert (16)
 *    choice, default 15. No fetch.
 *  - admin / superadmin → the live `/admin/ai-workflows` list (active_only, per_page
 *    50), default = the `is_default` workflow (else the first).
 *
 * The effective `value` is `override ?? default`, both derived — a user pick lives in
 * `override`, the default is derived from role + query data, so nothing is written in
 * an effect (React Compiler lint). `value` is the string id the composer converts to
 * `Number(value)` for the wire, or `undefined` when there is nothing to send.
 */

export interface WorkflowOption {
  id: string;
  label: string;
}

export interface WorkflowSelection {
  options: WorkflowOption[];
  /** Effective selection (override ?? default) — the string workflow id, or '' . */
  value: string;
  setValue: (next: string) => void;
  /** Admin catalogue still loading — the selector shows a skeleton chip. */
  isLoading: boolean;
}

const USER_WORKFLOWS: readonly WorkflowOption[] = [
  { id: '15', label: 'Lawexa Lite' },
  { id: '16', label: 'Lawexa Expert' },
] as const;
const DEFAULT_USER_WORKFLOW_ID = '15';
/** v1's persistence key (page.tsx) — a regular user's Lite/Expert pick survives
 *  reloads and tab switches; without it, returning Expert users were silently
 *  downgraded to Lite on every remount (reviewer M1). */
const USER_WORKFLOW_STORAGE_KEY = 'lawexa_user_workflow';

/** Stored pick, validated against the fixed user options (v1's exact rule).
 *  `null` server-side and for anything unrecognized. */
function readStoredUserWorkflow(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(USER_WORKFLOW_STORAGE_KEY);
    return stored && USER_WORKFLOWS.some((w) => w.id === stored) ? stored : null;
  } catch {
    return null;
  }
}

const ADMIN_PARAMS: AdminAiWorkflowsParams = { active_only: true, per_page: 50 };

export function useWorkflowSelection(role: UserRole | undefined): WorkflowSelection {
  const isAdmin = role === 'admin' || role === 'superadmin';

  const workflowsQuery = useQuery({
    ...workflowsQueries.list(ADMIN_PARAMS),
    enabled: isAdmin,
  });

  const options = useMemo<WorkflowOption[]>(() => {
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

  // Regular users seed from v1's persisted pick (lazy initializer — the same
  // accepted client-value pattern as useComposerDraft); admins always derive
  // their default from the live list.
  const [override, setOverride] = useState<string | null>(() =>
    isAdmin ? null : readStoredUserWorkflow(),
  );
  // Reset the override if it no longer matches a loaded option (e.g. the admin list
  // arrives) — derived, so it never needs an effect.
  const value = override && options.some((o) => o.id === override) ? override : defaultId;

  const setValue = (next: string) => {
    setOverride(next);
    if (!isAdmin) {
      try {
        window.localStorage.setItem(USER_WORKFLOW_STORAGE_KEY, next);
      } catch {
        // Storage unavailable (private mode) — the in-memory pick still applies.
      }
    }
  };

  return {
    options,
    value,
    setValue,
    isLoading: isAdmin && workflowsQuery.isPending,
  };
}
