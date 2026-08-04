import { apiClient } from '@/lib/api/client';
import type {
  NoteCreateInput,
  NoteEnvelope,
  NoteImageUpload,
  NoteListEnvelope,
  NoteUpdateInput,
} from './types';

/**
 * The v2 notes wire layer. Thin on purpose: same axios client and endpoints as
 * v1's `lib/api/notes.ts`, but typed against the honest v2 contract
 * (`./types.ts` — nullable titles, no pricing) and including the routes the
 * backend added for this rebuild (`by-id`, file delete). v1's module is left
 * untouched so its screens keep their own story.
 */

export interface NotesListParams {
  search?: string;
  page?: number;
  per_page?: number;
}

export const notesApi = {
  /**
   * The public library: published notes, FREE ONLY — `free: true` is baked in
   * because hiding paid notes is an owner decision ("note selling is not a
   * thing yet"), not a caller preference. No v2 surface may list paid notes.
   */
  library: async (params: NotesListParams = {}): Promise<NoteListEnvelope> => {
    const response = await apiClient.get<NoteListEnvelope>('/notes', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
        search: params.search || undefined,
        free: true,
      },
    });
    return response.data;
  },

  /** The viewer's own notes, drafts included (the My notes tab). */
  mine: async (params: NotesListParams = {}): Promise<NoteListEnvelope> => {
    const response = await apiClient.get<NoteListEnvelope>('/notes/my-notes', {
      params: {
        page: params.page ?? 1,
        per_page: params.per_page ?? 20,
        search: params.search || undefined,
      },
    });
    return response.data;
  },

  /** The reader's fetch — slug is the public address. */
  bySlug: async (slug: string): Promise<NoteEnvelope> => {
    const response = await apiClient.get<NoteEnvelope>(
      `/notes/${encodeURIComponent(slug)}`,
    );
    return response.data;
  },

  /**
   * The EDITOR's canonical fetch — new backend route, same payload and
   * visibility rules as the slug route, but immune to renames.
   */
  byId: async (id: number): Promise<NoteEnvelope> => {
    const response = await apiClient.get<NoteEnvelope>(`/notes/by-id/${id}`);
    return response.data;
  },

  /** Create a draft. Untitled is a first-class state — see `NoteCreateInput`. */
  create: async (data: NoteCreateInput): Promise<NoteEnvelope> => {
    const response = await apiClient.post<NoteEnvelope>('/notes', data);
    return response.data;
  },

  /** Save by id. The input type cannot carry `slug`, so a save can never break links. */
  update: async (id: number, data: NoteUpdateInput): Promise<NoteEnvelope> => {
    const response = await apiClient.put<NoteEnvelope>(`/notes/${id}`, data);
    return response.data;
  },

  /** Soft-delete the viewer's note. */
  remove: async (id: number): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/notes/${id}`,
    );
    return response.data;
  },

  /** Download the note as DOCX (server renders from the stored HTML). */
  exportDocx: async (slug: string): Promise<Blob> => {
    const response = await apiClient.get(
      `/notes/${encodeURIComponent(slug)}/export-docx`,
      { responseType: 'blob' },
    );
    return response.data;
  },

  /** Upload an image for embedding in note content (jpg/png/gif/webp, ≤5MB). */
  uploadImage: async (file: File): Promise<NoteImageUpload> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<NoteImageUpload>('/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Delete an uploaded file by the id the upload response returned. Removes
   * the S3 object AND the record — the URL dies. Uploader (or admin) only.
   * NOTE: deleting a note does NOT cascade to its embedded images; if the
   * product wants cleanup it must be explicit.
   */
  deleteFile: async (id: number): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/files/${id}`,
    );
    return response.data;
  },
};
