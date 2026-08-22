import { makeStatusMeta } from '@/lib/utils/observability';
import type {
  CaseMaintenanceItemStatus,
  CaseMaintenanceRunStatus,
  CaseMaintenanceRunType,
} from '@/types/admin-case-maintenance-runs';

/**
 * What each state is called and how it is coloured, in one place, so the run
 * list, the run header and the item table cannot describe the same state three
 * different ways.
 */
export const runStatusMeta = makeStatusMeta<CaseMaintenanceRunStatus>({
  pending: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'info', spinning: true },
  /* Amber, not grey: a paused run is not resting, it is WAITING FOR SOMEBODY.
     Either a person held it or the provider failed enough times that it stopped
     itself — both need attention, and grey is the colour of things that do
     not. */
  paused: { label: 'Paused', tone: 'warning' },
  completed: { label: 'Finished', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
});

export const itemStatusMeta = makeStatusMeta<CaseMaintenanceItemStatus>({
  pending: { label: 'Waiting', tone: 'neutral' },
  running: { label: 'Running', tone: 'info', spinning: true },
  /* NOT success. "Done" here means we looked at this case, which is not the
     same as changing it — see `changed_count`. Calling it success would invite
     exactly the misreading the count exists to prevent. */
  completed: { label: 'Done', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  /* The three that only an NWLR run can reach. Each one is a case sitting
     still until a person does something, so none of them is grey. */
  awaiting_confirmation: { label: 'Needs a decision', tone: 'warning' },
  conflict: { label: 'Disagrees', tone: 'warning' },
  no_match: { label: 'Not found', tone: 'warning' },
});

/**
 * Plain words for how a case was tied to a document at the provider.
 *
 * TWO VOCABULARIES LIVE HERE. The preview groups a case before anything runs
 * (`exact_key`); a finished item says how it was matched in the end and uses a
 * different word for the same thing (`citation_key`). Both are listed rather
 * than one being treated as a typo for the other.
 */
const MATCH_METHOD_LABELS: Record<string, string> = {
  // Preview buckets.
  exact_key: 'Matched by citation',
  part_only: 'Part known, page missing',
  title_only: 'Matched by title only',
  already_refreshed: 'Already refreshed',
  no_reference: 'Nothing to match on',
  // What a finished item reports.
  citation_key: 'Matched by citation',
  title_search: 'Matched by title search',
};

/**
 * NEVER RETURNS NOTHING. A value this screen has not met before is shown as
 * itself rather than as a blank cell — a real `citation_key` fell through the
 * closed version of this map and left the column empty, which reads as "we do
 * not know" when the truth was "we were not told".
 */
export function matchMethodLabel(method: string | null | undefined): string {
  if (!method) return '—';
  return MATCH_METHOD_LABELS[method] ?? method.replace(/_/g, ' ');
}

/** @deprecated Use {@link matchMethodLabel} — a bare lookup can return nothing. */
export const MATCH_METHOD_LABEL = MATCH_METHOD_LABELS;

export const RUN_TYPE_LABEL: Record<CaseMaintenanceRunType, string> = {
  nwlr_refresh: 'Refresh from NWLR',
  editorial_cleanup: 'Editorial cleanup',
};

/**
 * The one-line description under each kind, so somebody choosing between them
 * is told what it costs before they press anything.
 */
export const RUN_TYPE_DESCRIPTION: Record<CaseMaintenanceRunType, string> = {
  nwlr_refresh:
    'Fetches each case again from NWLR and replaces what we hold. Slow, and it calls the provider.',
  editorial_cleanup:
    'Fixes our own old formatting. Fast, free, and never leaves our servers.',
};
