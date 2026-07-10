import type {
  CaseTreatment,
  CitedByCase,
  CitedCaseEdge,
  Country,
  Court,
  RelatedCase,
} from '@/types/case';

/**
 * Normalized view model every related-case renderer consumes, regardless of
 * whether the source is a similar case, a cited_by reverse citation, or an
 * outgoing cited_cases edge. `href === null` means the row is not linkable
 * (an external citation to a case not in our database).
 */
export interface RelatedCaseDisplay {
  key: string;
  title: string;
  href: string | null;
  citation: string | null;
  court: Court | null;
  country: Country | null;
  judgmentDate: string | null;
  treatment: CaseTreatment | null;
}

/**
 * Map a similar case or a cited_by reverse citation (both case-summary shaped)
 * to the shared display model.
 */
export function relatedToDisplay(c: RelatedCase | CitedByCase): RelatedCaseDisplay {
  return {
    key: `case-${c.id}`,
    title: c.title,
    href: `/cases/${c.slug}`,
    citation: c.citation,
    court: c.court,
    country: c.country,
    judgmentDate: c.judgment_date,
    treatment: 'treatment' in c ? c.treatment : null,
  };
}

/**
 * Map an outgoing cited_cases edge to the shared display model. Edges whose
 * target is not in our database (`cited_case_id === null`) render `raw` as
 * plain text with no link.
 */
export function citedEdgeToDisplay(edge: CitedCaseEdge): RelatedCaseDisplay {
  const linked = edge.cited_case_id !== null && !!edge.slug;
  return {
    key: `edge-${edge.id}`,
    title: edge.title ?? edge.raw ?? edge.citation ?? 'Unlinked citation',
    href: linked ? `/cases/${edge.slug}` : null,
    citation: edge.citation,
    court: null,
    country: null,
    judgmentDate: null,
    treatment: edge.treatment,
  };
}

export type TreatmentTone = 'neutral' | 'caution' | 'negative';

const TREATMENT_META: Record<CaseTreatment, { label: string; tone: TreatmentTone }> = {
  followed: { label: 'Followed', tone: 'neutral' },
  applied: { label: 'Applied', tone: 'neutral' },
  approved: { label: 'Approved', tone: 'neutral' },
  considered: { label: 'Considered', tone: 'neutral' },
  referred_to: { label: 'Referred to', tone: 'neutral' },
  distinguished: { label: 'Distinguished', tone: 'caution' },
  doubted: { label: 'Doubted', tone: 'caution' },
  not_followed: { label: 'Not followed', tone: 'negative' },
  overruled: { label: 'Overruled', tone: 'negative' },
};

/**
 * Resolve a treatment value to a display label and tone. Unknown values (the
 * backend may extend the enum) are title-cased and shown with a neutral tone.
 */
export function formatTreatment(
  treatment: string | null
): { label: string; tone: TreatmentTone } | null {
  if (!treatment) return null;
  const known = TREATMENT_META[treatment as CaseTreatment];
  if (known) return known;
  const label = treatment
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return { label, tone: 'neutral' };
}
