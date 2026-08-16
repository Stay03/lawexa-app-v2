'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { profileApi } from '@/lib/api/profile';
import { useAuthStore } from '@/lib/stores/authStore';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/auth';
import { updateProfile } from './api';
import type { ProfileSavePayload } from './form-model';
import { profileQueries } from './queries';

/**
 * The profile writes: the form, and the two avatar actions.
 *
 * ── THREE PLACES HOLD THIS PERSON, AND ALL THREE ARE UPDATED ───────────────
 * A saved name has to become the name everywhere, and in v2 "everywhere" is
 * not one cache:
 *
 *  1. THIS QUERY. The server's response is folded into `profileQueries.me()`,
 *     so re-opening the screen inside the stale window shows what was saved
 *     rather than what was there before.
 *  2. THE PERSISTED AUTH STORE (`lib/stores/authStore`). It is the same store
 *     in both apps, it survives a reload, and several v2 surfaces read the
 *     profile straight out of it (the radar form takes its default
 *     jurisdiction from `user.profile.country`). v1's own `useUpdateProfile`
 *     writes here for the same reason, including its careful `undefined` guard
 *     on the handle, which is carried over below.
 *  3. THE SERVER SESSION SNAPSHOT. The shell's header avatar, the drawer, and
 *     the settings account card all read `useV2Session()`, which is resolved
 *     by `app/v2/layout.tsx` on the server and does not re-run on a soft
 *     navigation. `router.refresh()` re-runs it, so the name and the face in
 *     the chrome catch up with the save instead of waiting for a hard load.
 *
 * ── ERRORS ARE INLINE, SO THE GLOBAL TOAST STANDS DOWN ─────────────────────
 * Every one of these carries `meta.silentError`. A 422 belongs beside the field
 * that caused it, and the two avatar failures belong under the avatar. The
 * global `MutationCache.onError` channel would otherwise say the same thing a
 * second time, in a corner, with no field attached.
 */

/** Fold the server's user into the cached `/auth/me` envelope, field by field,
 *  so a response that omits something cannot blank what we already knew. */
function foldUser(
  queryClient: QueryClient,
  update: (user: User) => Partial<User>,
) {
  queryClient.setQueryData<ApiResponse<{ user: User }>>(
    profileQueries.me().queryKey,
    (previous) => {
      if (!previous?.data) return previous;
      return {
        ...previous,
        data: { user: { ...previous.data.user, ...update(previous.data.user) } },
      };
    },
  );
}

/** Save the form. The payload is a diff, so it writes only what changed. */
export function useSaveProfile() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: ProfileSavePayload) => updateProfile(payload),
    meta: { silentError: true },
    onSuccess: (response) => {
      const saved = response.data;
      if (!saved) return;

      foldUser(queryClient, () => saved);
      useAuthStore.getState().updateUser({
        name: saved.name,
        // The handle identifies the account everywhere it can be tagged, so the
        // cached session has to carry the new one immediately. It travels only
        // when the response carries the key: an own `undefined` wins the
        // store's spread and would blank a good cached handle. `null` is a real
        // answer (the account has none) and does travel.
        ...(saved.username === undefined ? {} : { username: saved.username }),
        profile: saved.profile,
        areas_of_expertise: saved.areas_of_expertise,
      });
      router.refresh();
    },
  });
}

/** Replace the account photo. The caller has already checked the file. */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    meta: { silentError: true },
    onSuccess: (response) => {
      const avatarUrl = response.data?.avatar_url;
      if (!avatarUrl) return;
      foldUser(queryClient, () => ({ avatar_url: avatarUrl }));
      useAuthStore.getState().updateUser({ avatar_url: avatarUrl });
      router.refresh();
    },
  });
}

/** Remove the account photo, which puts the initials back. */
export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => profileApi.deleteAvatar(),
    meta: { silentError: true },
    onSuccess: () => {
      foldUser(queryClient, () => ({ avatar_url: null }));
      useAuthStore.getState().updateUser({ avatar_url: null });
      router.refresh();
    },
  });
}
