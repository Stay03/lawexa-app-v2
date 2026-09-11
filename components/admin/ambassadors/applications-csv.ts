import type { AmbassadorApplication } from '@/types/ambassador';
import { csvDocument, localDayOf } from './financials-csv';

/**
 * The applications list as a CSV file.
 *
 * It holds every row the filters, search and sort leave, in the order the
 * table shows them, and not only the page on screen. Quoting and the local-day
 * dates are the financials export's own (`./financials-csv`), and the page
 * hands the file to the same `downloadCsv`, so both files open the same way.
 *
 * A missing value is an empty cell. The long free-text answers (motivation,
 * growth plan, leadership experience) and the review notes are not in the
 * file; the Review dialog shows them.
 */
export function applicationsCsv(rows: AmbassadorApplication[]): string {
  const header = [
    'Name',
    'Email',
    'Phone',
    'Country',
    'University',
    'Law school',
    'Faculty',
    'Level',
    'Status',
    'Submitted',
    'Reviewed',
    'Reviewed by',
    'Heard from',
    'Social handle',
  ];

  return csvDocument(
    header,
    rows.map((row) => [
      row.name,
      row.email,
      row.phone,
      row.country,
      row.university,
      row.law_school,
      row.faculty,
      row.level,
      row.status_label || row.status,
      localDayOf(row.created_at),
      localDayOf(row.reviewed_at),
      row.reviewed_by?.name ?? null,
      row.heard_from,
      row.social_handle,
    ])
  );
}
