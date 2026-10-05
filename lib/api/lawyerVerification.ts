import { apiClient } from './client';

export interface LawyerProfileDocument {
  id: number;
  url: string;
  original_name: string;
  mime_type: string;
  size: number;
  created_at: string;
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
   * @param options - Optional progress callback (bytes sent, bytes total) and
   *   abort signal. Both are optional, so existing callers are unchanged.
   */
  uploadDocument: async (
    file: File,
    options: {
      onProgress?: (sent: number, total: number) => void;
      signal?: AbortSignal;
    } = {}
  ) => {
    const formData = new FormData();
    formData.append('file', file);

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
