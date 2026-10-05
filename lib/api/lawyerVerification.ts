import { apiClient } from './client';

/**
 * Which verification document a file is. The wire keys are v1 onboarding's
 * (`app/(onboarding)/onboarding/step-8/page.tsx`): Means of ID, Call to Bar
 * Certificate, Practicing License, CV / Resume.
 */
export type LawyerDocumentType = 'id' | 'certificate' | 'license' | 'cv';

export interface LawyerProfileDocument {
  id: number;
  url: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
  /** `null` for a file uploaded before the type existed. */
  document_type?: LawyerDocumentType | null;
}

export type VerificationStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface LawyerProfile {
  id: number;
  user_id: number;
  is_verified: boolean | null;
  verified_at: string | null;
  verification_submitted_at: string | null;
  verification_notes?: string | null;
  rejection_reason?: string | null;
  verification_status: VerificationStatus;
  can_resubmit: boolean;
  documents: LawyerProfileDocument[];
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  errors?: Record<string, string[]> | null;
}

export const lawyerVerificationApi = {
  /**
   * Get the authenticated user's lawyer profile
   */
  getMyProfile: async () => {
    const response = await apiClient.get<ApiResponse<LawyerProfile>>(
      '/lawyer-verification/my-profile'
    );
    return response.data;
  },

  /**
   * Create a new lawyer profile for the authenticated user
   */
  createProfile: async () => {
    const response = await apiClient.post<ApiResponse<LawyerProfile>>(
      '/lawyer-verification/profile'
    );
    return response.data;
  },

  /**
   * Upload a verification document
   * @param file - The file to upload (PDF, JPG, JPEG, PNG - max 10MB)
   * @param options - Optional document type, progress callback (bytes sent,
   *   bytes total) and abort signal. All optional, so existing callers are
   *   unchanged. A second file of a type the profile already holds is refused
   *   with a 422.
   */
  uploadDocument: async (
    file: File,
    options: {
      documentType?: LawyerDocumentType;
      onProgress?: (sent: number, total: number) => void;
      signal?: AbortSignal;
    } = {}
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options.documentType) {
      formData.append('document_type', options.documentType);
    }

    const response = await apiClient.post<ApiResponse<LawyerProfileDocument>>(
      '/lawyer-verification/documents',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        signal: options.signal,
        onUploadProgress: options.onProgress
          ? (event) => {
              // `event.total` is absent on some transports; the file's own
              // size is the honest denominator.
              options.onProgress?.(event.loaded, event.total ?? file.size);
            }
          : undefined,
      }
    );
    return response.data;
  },

  /**
   * Delete a verification document
   * @param fileId - The ID of the file to delete
   */
  deleteDocument: async (fileId: number) => {
    const response = await apiClient.delete<ApiResponse<string>>(
      `/lawyer-verification/documents/${fileId}`
    );
    return response.data;
  },

  /**
   * Submit the lawyer profile for verification
   */
  submitForVerification: async () => {
    const response = await apiClient.post<ApiResponse<LawyerProfile>>(
      '/lawyer-verification/submit'
    );
    return response.data;
  },
};
