import type { CaseIngestionSourceFormat } from '@/types/admin-case-ingestions';

/**
 * Reader-facing names for `source_format`.
 *
 * `legal_api` is called NWLR rather than "Legal API" on purpose: during a blast
 * the person watching this screen is asking "is the NWLR run going", and the
 * gateway's name is our plumbing, not theirs. The two upload formats keep the
 * word "upload" so a row with no file reads as a fetch rather than a broken
 * upload.
 */
const SOURCE_FORMAT_LABEL: Record<CaseIngestionSourceFormat, string> = {
  legal_api: 'NWLR',
  akn_xml: 'AKN upload',
  pdf: 'PDF upload',
};

export function sourceFormatLabel(format: CaseIngestionSourceFormat | string): string {
  return SOURCE_FORMAT_LABEL[format as CaseIngestionSourceFormat] ?? String(format);
}

/** Only provider jobs carry a provider id; uploads carry a file name instead. */
export function isProviderFetch(format: CaseIngestionSourceFormat | string): boolean {
  return format === 'legal_api';
}
