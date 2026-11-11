import { queryOptions, useMutation } from '@tanstack/react-query';

import { certificatesApi } from '@/lib/api/certificates';
import { saveExportedFile } from '@/lib/certificates/save-file';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * My certificates (shapes agreed with WOZ, 11 November 2026):
 *
 *   GET /certificates                     mine, newest first
 *   GET /certificates/{number}/download   the PDF, owner only
 */
export const myCertificatesQueries = {
  all: ['settings', 'certificates'] as const,

  list: () =>
    queryOptions({
      queryKey: [...myCertificatesQueries.all, 'list'] as const,
      queryFn: () => certificatesApi.mine(),
      staleTime: STALE_TIMES.standard,
    }),
};

/** Fetches one PDF with the session and saves it. The screen shows its own error line. */
export function useDownloadCertificate() {
  return useMutation({
    mutationFn: async (number: string) => saveExportedFile(await certificatesApi.download(number)),
    meta: { silentError: true },
  });
}
