import type {
  CaseDuplicateRef,
  CaseDuplicateSignal,
  CaseIngestion,
} from '@/types/admin-case-ingestions';

/* WHAT THE MATCH WAS, IN WORDS SOMEBODY CAN JUDGE.
   `court_and_suit_no` tells a reader nothing about whether to trust the match.
   The test does: a shared suit number is near proof, a shared date and both
   party names is strong, and a shared page of a reporter is strong for a
   different reason. Whoever opens the row is deciding whether to merge two
   case records, so the screen has to say which test fired. */
const SIGNAL_LABEL: Record<CaseDuplicateSignal, string> = {
  court_and_suit_no: 'same court and suit number',
  judgment_date_and_parties: 'same judgment date and both parties',
  reporter_volume_and_page: 'same reporter, volume and page',
};

export function duplicateSignalLabel(signal: string | undefined): string | null {
  if (!signal) return null;
  return SIGNAL_LABEL[signal as CaseDuplicateSignal] ?? signal;
}

/** The flagged cases on a job, in one list, whether it created a case or refused to. */
export function duplicateRefs(job: CaseIngestion): CaseDuplicateRef[] {
  const result = job.result;
  if (!result) return [];
  if (result.duplicate_of) return [result.duplicate_of];
  return result.possible_duplicates ?? [];
}
