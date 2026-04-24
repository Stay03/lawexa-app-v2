const BUCKET_LABELS: Record<string, string> = {
  unknown: 'Unknown',
  direct: 'Direct',
  referral: 'Referral',
};

export function formatSourceLabel(source: string): string {
  return BUCKET_LABELS[source] ?? source;
}
