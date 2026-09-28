'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { statutesApi } from '@/lib/api/statutes';
import type { StatuteAnnotation, StatuteAnnotationType } from '@/types/statute';
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
