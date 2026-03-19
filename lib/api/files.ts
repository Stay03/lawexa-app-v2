import { apiClient } from './client';
import type {
  FileListResponse,
  FileDetailResponse,
  FileUploadResponse,
  FileDownloadResponse,
  FileDeleteResponse,
  FileListParams,
} from '@/types/file';

/**
 * Files API service for user file management
 */
export const filesApi = {
  /**
   * Get paginated list of user files
   */
  getList: async (params: FileListParams = {}): Promise<FileListResponse> => {
    const response = await apiClient.get<FileListResponse>('/files', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        category: params.category || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get single file details
   */
  getById: async (id: number): Promise<FileDetailResponse> => {
    const response = await apiClient.get<FileDetailResponse>(`/files/${id}`);
    return response.data;
  },

  /**
   * Upload a content image (jpg, jpeg, png, gif, webp — max 5MB)
   */
  uploadImage: async (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<FileUploadResponse>('/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Upload a document (pdf, doc, docx, rtf — max 10MB)
   */
  uploadDocument: async (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<FileUploadResponse>('/files/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Delete a file
   */
  deleteFile: async (id: number): Promise<FileDeleteResponse> => {
    const response = await apiClient.delete<FileDeleteResponse>(`/files/${id}`);
    return response.data;
  },

  /**
   * Get download URL for a file (signed URL for S3)
   */
  getDownloadUrl: async (id: number): Promise<FileDownloadResponse> => {
    const response = await apiClient.get<FileDownloadResponse>(`/files/${id}/download`);
    return response.data;
  },
};
