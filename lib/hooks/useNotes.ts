'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi } from '@/lib/api/notes';
import type {
  NoteListParams,
  MyNotesParams,
  CreateNoteData,
  UpdateNoteData,
} from '@/types/note';

// Query keys factory
export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  list: (params: NoteListParams) => [...noteKeys.lists(), params] as const,
  myNotes: () => [...noteKeys.all, 'my-notes'] as const,
  myNotesList: (params: MyNotesParams) => [...noteKeys.myNotes(), params] as const,
  details: () => [...noteKeys.all, 'detail'] as const,
  detail: (slug: string) => [...noteKeys.details(), slug] as const,
};

/**
 * Hook for fetching paginated public notes list
 */
export function useNotes(params: NoteListParams = {}) {
  return useQuery({
    queryKey: noteKeys.list(params),
    queryFn: () => notesApi.getList(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for fetching authenticated user's notes
 */
export function useMyNotes(params: MyNotesParams = {}) {
  return useQuery({
    queryKey: noteKeys.myNotesList(params),
    queryFn: () => notesApi.getMyNotes(params),
    staleTime: 1 * 60 * 1000, // 1 minute (more frequently updated)
  });
}

/**
 * Hook for fetching single note by slug
 */
export function useNote(slug: string) {
  return useQuery({
    queryKey: noteKeys.detail(slug),
    queryFn: () => notesApi.getBySlug(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for creating a new note
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNoteData) => notesApi.create(data),
    onSuccess: () => {
      // Invalidate all note lists
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noteKeys.myNotes() });
    },
  });
}

/**
 * Hook for updating a note
 */
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateNoteData }) =>
      notesApi.update(id, data),
    onSuccess: (response) => {
      // Update the detail cache
      if (response.data?.slug) {
        queryClient.setQueryData(noteKeys.detail(response.data.slug), response);
      }
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noteKeys.myNotes() });
    },
  });
}

/**
 * Hook for deleting a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noteKeys.myNotes() });
    },
  });
}

/**
 * Hook for publishing a note
 */
export function usePublishNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notesApi.publish(id),
    onSuccess: (response) => {
      if (response.data?.slug) {
        queryClient.setQueryData(noteKeys.detail(response.data.slug), response);
      }
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noteKeys.myNotes() });
    },
  });
}

/**
 * Hook for unpublishing a note
 */
export function useUnpublishNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notesApi.unpublish(id),
    onSuccess: (response) => {
      if (response.data?.slug) {
        queryClient.setQueryData(noteKeys.detail(response.data.slug), response);
      }
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noteKeys.myNotes() });
    },
  });
}

/**
 * Hook for uploading a thumbnail
 */
export function useUploadThumbnail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      notesApi.uploadThumbnail(id, file),
    onSuccess: (response) => {
      if (response.data?.slug) {
        queryClient.setQueryData(noteKeys.detail(response.data.slug), response);
      }
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noteKeys.myNotes() });
    },
  });
}

/**
 * Hook for deleting a thumbnail
 */
export function useDeleteThumbnail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notesApi.deleteThumbnail(id),
    onSuccess: (response) => {
      if (response.data?.slug) {
        queryClient.setQueryData(noteKeys.detail(response.data.slug), response);
      }
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noteKeys.myNotes() });
    },
  });
}

/**
 * Hook for uploading content images
 */
export function useUploadContentImage() {
  return useMutation({
    mutationFn: (file: File) => notesApi.uploadContentImage(file),
  });
}
