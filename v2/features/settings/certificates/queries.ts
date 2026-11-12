import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';

import { certificatesApi } from '@/lib/api/certificates';
import { saveExportedFile } from '@/lib/certificates/save-file';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * My certificates (shapes agreed with WOZ, 11 November 2026):
 *
 *   GET /certificates                     mine, newest first
 *   GET /certificates/{number}/download   the PDF, owner only
 *   GET /certificates/pending             waiting for the printed name
 *   POST /certificates/pending/{uuid}/confirm {printed_name}
 */
export const myCertificatesQueries = {
  all: ['settings', 'certificates'] as const,

  list: () =>
    queryOptions({
      queryKey: [...myCertificatesQueries.all, 'list'] as const,
      queryFn: () => certificatesApi.mine(),
      staleTime: STALE_TIMES.standard,
    }),

  /** Certificates waiting for their printed name (`GET /certificates/pending`). */
  pending: () =>
    queryOptions({
      queryKey: [...myCertificatesQueries.all, 'pending'] as const,
      queryFn: () => certificatesApi.pending(),
      staleTime: STALE_TIMES.standard,
    }),
};

/**
 * Confirms the printed name, which issues the certificate. Both lists are read
 * again afterwards: the pending row goes and the certificate appears.
 */
export function useConfirmCertificateName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pendingUuid, printedName }: { pendingUuid: string; printedName: string }) =>
      certificatesApi.confirmName(pendingUuid, printedName),
    meta: { silentError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myCertificatesQueries.all }),
  });
}

/** Fetches one PDF with the session and saves it. The screen shows its own error line. */
export function useDownloadCertificate() {
  return useMutation({
    mutationFn: async (number: string) => saveExportedFile(await certificatesApi.download(number)),
    meta: { silentError: true },
  });
}
