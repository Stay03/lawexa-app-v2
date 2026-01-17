import { apiClient } from './client';
import type {
  NoteListResponse,
  NoteResponse,
  NoteListParams,
  MyNotesParams,
  CreateNoteData,
  UpdateNoteData,
  FileUploadResponse,
} from '@/types/note';

/**
 * Notes API service for Phase 6 endpoints
 */
export const notesApi = {
  /**
   * Get paginated list of public published notes
   */
  getList: async (params: NoteListParams = {}): Promise<NoteListResponse> => {
    const response = await apiClient.get<NoteListResponse>('/notes', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        search: params.search || undefined,
        tags: Array.isArray(params.tags) ? params.tags.join(',') : params.tags || undefined,
        free: params.free ?? undefined,
        paid: params.paid ?? undefined,
        user: params.user || undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get paginated list of authenticated user's notes
   */
  getMyNotes: async (params: MyNotesParams = {}): Promise<NoteListResponse> => {
    const response = await apiClient.get<NoteListResponse>('/notes/my-notes', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 15,
        search: params.search || undefined,
        tags: Array.isArray(params.tags) ? params.tags.join(',') : params.tags || undefined,
        free: params.free ?? undefined,
        paid: params.paid ?? undefined,
        status: params.status || undefined,
        is_private: params.is_private ?? undefined,
        with_trashed: params.with_trashed ?? undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
      },
    });
    return response.data;
  },

  /**
   * Get single note by slug
   */
  getBySlug: async (slug: string): Promise<NoteResponse> => {
    const response = await apiClient.get<NoteResponse>(`/notes/${slug}`);
    return response.data;
  },

  /**
   * Create a new note
   */
  create: async (data: CreateNoteData): Promise<NoteResponse> => {
    const response = await apiClient.post<NoteResponse>('/notes', data);
    return response.data;
  },

  /**
   * Update an existing note by ID
   */
  update: async (id: number, data: UpdateNoteData): Promise<NoteResponse> => {
    const response = await apiClient.put<NoteResponse>(`/notes/${id}`, data);
    return response.data;
  },

  /**
   * Delete a note by ID (soft delete)
   */
  delete: async (id: number): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(`/notes/${id}`);
    return response.data;
  },

  /**
   * Restore a soft-deleted note (admin only)
   */
  restore: async (id: number): Promise<NoteResponse> => {
    const response = await apiClient.post<NoteResponse>(`/notes/${id}/restore`);
    return response.data;
  },

  /**
   * Publish a draft note
   */
  publish: async (id: number): Promise<NoteResponse> => {
    const response = await apiClient.post<NoteResponse>(`/notes/${id}/publish`);
    return response.data;
  },

  /**
   * Unpublish a note (move to draft)
   */
  unpublish: async (id: number): Promise<NoteResponse> => {
    const response = await apiClient.post<NoteResponse>(`/notes/${id}/unpublish`);
    return response.data;
  },

  /**
   * Upload a thumbnail image for a note
   */
  uploadThumbnail: async (id: number, file: File): Promise<NoteResponse> => {
    const formData = new FormData();
    formData.append('thumbnail', file);

    const response = await apiClient.post<NoteResponse>(`/notes/${id}/thumbnail`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Delete a note's thumbnail
   */
  deleteThumbnail: async (id: number): Promise<NoteResponse> => {
    const response = await apiClient.delete<NoteResponse>(`/notes/${id}/thumbnail`);
    return response.data;
  },

  /**
   * Upload a content image (for embedding in note content)
   */
  uploadContentImage: async (file: File): Promise<FileUploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<FileUploadResponse>('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
