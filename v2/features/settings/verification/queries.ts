import {
  queryOptions,
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import {
  lawyerVerificationApi,
  type LawyerProfile,
  type LawyerProfileDocument,
} from '@/lib/api/lawyerVerification';
import { extractApiError, isNotFoundError } from '@/lib/utils/api-error';
import { STALE_TIMES } from '@/v2/runtime/query';

/**
 * Lawyer verification: the read and the four writes, against the routes v1
 * already calls (`lib/api/lawyerVerification.ts`):
 *
 *   GET    /lawyer-verification/my-profile        the profile, or 404 for none
 *   POST   /lawyer-verification/profile           create it (403 if it exists)
 *   POST   /lawyer-verification/documents         upload one file (`file`)
 *   DELETE /lawyer-verification/documents/{id}    remove one
 *   POST   /lawyer-verification/submit            send for review; returns the profile
 *
 * `standard` freshness and the default refetch on focus: a reviewer's decision
 * lands while the page sits in a background tab, and coming back to it is the
 * moment the reader should see it.
 */
export const verificationQueries = {
  all: ['settings', 'verification'] as const,

  /** `null` is a real answer: the API's 404 for an account with no profile. */
  profile: () =>
    queryOptions({
      queryKey: verificationQueries.all,
      queryFn: async (): Promise<LawyerProfile | null> => {
        try {
          return (await lawyerVerificationApi.getMyProfile()).data;
        } catch (error) {
          if (isNotFoundError(error)) return null;
          throw error;
        }
      },
      staleTime: STALE_TIMES.standard,
    }),
};

/**
 * Whether a write's response is a whole profile. The submit route is typed as
 * returning one, and the cache is only replaced when it really did: a partial
 * body written over the profile would leave the screen reading `documents` off
 * an object that has none. Anything else falls back to the re-read.
 */
function isProfile(value: unknown): value is LawyerProfile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<LawyerProfile>;
  return typeof candidate.verification_status === 'string' && Array.isArray(candidate.documents);
}

function writeProfile(
  queryClient: QueryClient,
  update: (profile: LawyerProfile) => LawyerProfile,
) {
  queryClient.setQueryData<LawyerProfile | null>(verificationQueries.all, (profile) =>
    profile ? update(profile) : profile,
  );
}

/**
 * Make sure a profile exists before the first upload.
 *
 * A lawyer who skipped onboarding's verification step has none, and the API
 * refuses documents until there is one. Creating it is not something the
 * reader should have to press a button for, so the first upload does it. A 403
 * means one already exists (another tab made it), which is the outcome wanted;
 * the cache is re-read so the documents land on the real record.
 */
export function useEnsureVerificationProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      try {
        const created = (await lawyerVerificationApi.createProfile()).data;
        if (isProfile(created)) {
          queryClient.setQueryData<LawyerProfile | null>(verificationQueries.all, created);
        } else {
          await queryClient.invalidateQueries({ queryKey: verificationQueries.all });
        }
      } catch (error) {
        if (extractApiError(error).status !== 403) throw error;
        await queryClient.invalidateQueries({ queryKey: verificationQueries.all });
      }
    },
    meta: { silentError: true },
  });
}

export interface UploadVariables {
  file: File;
  onProgress: (sent: number, total: number) => void;
  signal: AbortSignal;
}

/**
 * Upload one document. The stored file joins the cached list at once, so its
 * row replaces the progress row in the same frame, then the list is re-read.
 * Errors are drawn on the upload's own row, never as a toast.
 */
export function useUploadVerificationDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, onProgress, signal }: UploadVariables) =>
      (await lawyerVerificationApi.uploadDocument(file, { onProgress, signal })).data,
    meta: { silentError: true },
    onSuccess: (document: LawyerProfileDocument | undefined) => {
      // The same rule as `isProfile`: only a whole record joins the cache.
      if (typeof document?.id === 'number') {
        writeProfile(queryClient, (profile) => ({
          ...profile,
          documents: [...profile.documents.filter((d) => d.id !== document.id), document],
        }));
      }
      void queryClient.invalidateQueries({ queryKey: verificationQueries.all });
    },
  });
}

/**
 * Remove one document. The global error toast carries a refusal: the row stays
 * where it was, so there is nothing on the page to attach a message to.
 */
export function useRemoveVerificationDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: number) => lawyerVerificationApi.deleteDocument(documentId),
    onSuccess: (_response, documentId) => {
      writeProfile(queryClient, (profile) => ({
        ...profile,
        documents: profile.documents.filter((d) => d.id !== documentId),
      }));
      void queryClient.invalidateQueries({ queryKey: verificationQueries.all });
    },
  });
}

/**
 * Send the documents for review. The response is the updated profile, which
 * replaces the cached one so the status changes without waiting for a re-read.
 * A refusal is drawn under the button.
 */
export function useSubmitVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await lawyerVerificationApi.submitForVerification()).data,
    meta: { silentError: true },
    onSuccess: (profile: LawyerProfile) => {
      if (isProfile(profile)) {
        queryClient.setQueryData<LawyerProfile | null>(verificationQueries.all, profile);
      }
      void queryClient.invalidateQueries({ queryKey: verificationQueries.all });
    },
  });
}
