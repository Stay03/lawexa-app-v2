'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { statutesApi } from '@/lib/api/statutes';
import type { StatuteAnnotation, StatuteAnnotationCreate, StatuteAnnotationType } from '@/types/statute';
import { statutesQueries } from '../queries';

/**
 * Edit, decide and delete a researcher's note. Each waits for the server and
 * then writes the server's answer into the statute's notes cache, so the
 * panel and the underlines show exactly what was stored; a failure changes
 * nothing on screen and rides the global mutation-error toast.
 *
 * Not optimistic on purpose: these are deliberate, occasional edits by a
 * researcher, and a note that briefly shows a decision the server then
 * refused is worse than a beat's wait on the button.
 */

function useReplaceInCache(slug: string) {
  const queryClient = useQueryClient();
  const key = statutesQueries.annotations(slug).queryKey;
  return {
    replace: (next: StatuteAnnotation) =>
      queryClient.setQueryData<StatuteAnnotation[]>(key, (notes) =>
        notes?.map((note) => (note.uuid === next.uuid ? next : note)),
      ),
    remove: (uuid: string) =>
      queryClient.setQueryData<StatuteAnnotation[]>(key, (notes) =>
        notes?.filter((note) => note.uuid !== uuid),
      ),
  };
}

export function useUpdateNote(slug: string) {
  const cache = useReplaceInCache(slug);
  return useMutation({
    mutationFn: ({ uuid, type, body }: { uuid: string; type?: StatuteAnnotationType; body?: string }) =>
      statutesApi.updateAnnotation(uuid, { type, body }),
    onSuccess: (response) => cache.replace(response.data),
  });
}

export function useDecideNote(slug: string) {
  const cache = useReplaceInCache(slug);
  return useMutation({
    mutationFn: ({ uuid, decision }: { uuid: string; decision: string }) =>
      statutesApi.decideAnnotation(uuid, decision),
    onSuccess: (response) => cache.replace(response.data),
  });
}

export function useDeleteNote(slug: string) {
  const cache = useReplaceInCache(slug);
  return useMutation({
    mutationFn: ({ uuid }: { uuid: string }) => statutesApi.deleteAnnotation(uuid),
    onSuccess: (_response, { uuid }) => cache.remove(uuid),
  });
}

/**
 * A new note. The list is refetched afterwards rather than patched: the
 * server orders notes (whole statute first, then by the part's position),
 * and a refetch is the one way the new note lands exactly where it belongs.
 */
export function useCreateNote(slug: string, statuteId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (note: StatuteAnnotationCreate) => {
      if (statuteId === null) throw new Error('The statute is not loaded yet.');
      return statutesApi.createAnnotation(statuteId, note);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: statutesQueries.annotations(slug).queryKey }),
  });
}

/**
 * Pictures of the print on a note: add, recaption or move, and delete. Each
 * answers the whole note, which replaces the cached one, so the strip and the
 * form show exactly what was stored (a delete answers with the positions
 * renumbered). Not optimistic, for the reason above; the form shows a move at
 * once on its own and lets go of it when the server answers.
 */
export function useAddNoteImages(slug: string) {
  const cache = useReplaceInCache(slug);
  return useMutation({
    mutationFn: ({
      uuid,
      files,
      onProgress,
    }: {
      uuid: string;
      files: readonly File[];
      onProgress?: (sent: number, total: number) => void;
    }) => statutesApi.addAnnotationImages(uuid, files, { onProgress }),
    onSuccess: (response) => cache.replace(response.data),
  });
}

export function useUpdateNoteImage(slug: string) {
  const cache = useReplaceInCache(slug);
  return useMutation({
    mutationFn: ({
      uuid,
      imageId,
      caption,
      position,
    }: {
      uuid: string;
      imageId: number;
      caption?: string | null;
      position?: number;
    }) => statutesApi.updateAnnotationImage(uuid, imageId, { caption, position }),
    onSuccess: (response) => cache.replace(response.data),
  });
}

export function useDeleteNoteImage(slug: string) {
  const cache = useReplaceInCache(slug);
  return useMutation({
    mutationFn: ({ uuid, imageId }: { uuid: string; imageId: number }) =>
      statutesApi.deleteAnnotationImage(uuid, imageId),
    onSuccess: (response) => cache.replace(response.data),
  });
}

/**
 * Fetch the statute's notes again, for links that work: each picture's `url`
 * is signed for one hour. Several pictures failing at once share one request,
 * because a fetch already on its way is joined rather than restarted.
 */
export function useFetchFreshNotes(slug: string) {
  const queryClient = useQueryClient();
  return (): Promise<StatuteAnnotation[]> =>
    queryClient.fetchQuery({ ...statutesQueries.annotations(slug), staleTime: 0 });
}
