import type { TSourceType } from '@/types/admin';

const BUCKET_LABELS: Record<string, string> = {
  unknown: 'Unknown',
  direct: 'Direct',
  referral: 'Referral',
};

export function formatSourceLabel(source: string): string {
  return BUCKET_LABELS[source] ?? source;
}

export const SOURCE_TYPE_OPTIONS: { value: TSourceType; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'organic', label: 'Organic' },
  { value: 'referral', label: 'Referral' },
  { value: 'direct', label: 'Direct' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];
