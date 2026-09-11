// The sweep states of a partial case, described in one place, so the page and
// the filter bar cannot disagree about which ones exist or what they say.

import { CirclePause, FileDiff } from 'lucide-react';
import type { CaseEnrichmentSummary, EnrichmentSweep } from '@/types/admin-case-enrichments';

export interface SweepMeta {
  /** The toggle's label. */
  label: string;
  icon: typeof CirclePause;
  /** What the list is, shown under the filters while the toggle is on. */
  note: string;
  /** The summary count whose presence, as a number, says the API has this filter. */
  countField: 'partial_stopped_cases' | 'partial_text_changed_cases';
  /** The pager's name for the rows, which are cases, not runs. */
  plural: string;
  /** What an empty list says. */
  empty: string;
}

/** Keyed by EnrichmentSweep, so a new sweep value does not compile until it is described here. */
export const SWEEP_META: Record<EnrichmentSweep, SweepMeta> = {
  stopped: {
    label: 'Stopped',
    icon: CirclePause,
    note:
      'Partial cases the resume sweep no longer retries. Their last 3 attempts read no new part. An attempt that reads a new part, or a change to the report text, ends the stop.',
    countField: 'partial_stopped_cases',
    plural: 'stopped cases',
    empty: 'No stopped cases',
  },
  text_changed: {
    label: 'Report changed',
    icon: FileDiff,
    note:
      'Partial cases whose report text changed after their partial run. The resume sweep does not resume them.',
    countField: 'partial_text_changed_cases',
    plural: 'cases with a changed report',
    empty: 'No cases with a changed report',
  },
};

/** Every sweep, in display order. */
export const SWEEPS = Object.keys(SWEEP_META) as EnrichmentSweep[];

export const isSweep = (value: string | null): value is EnrichmentSweep =>
  value !== null && Object.prototype.hasOwnProperty.call(SWEEP_META, value);

/** The sweep filters an API has: those whose count its summary sends as a number. */
export function sweepsIn(summary: CaseEnrichmentSummary): EnrichmentSweep[] {
  return SWEEPS.filter((sweep) => typeof summary[SWEEP_META[sweep].countField] === 'number');
}
