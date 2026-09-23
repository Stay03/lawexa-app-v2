import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type { User } from '@/types/auth';
import type { ProfileSavePayload } from './form-model';

/**
 * The profile wire layer, which is one call.
 *
 * It exists for a single reason: the payload type. `lib/api/profile.ts` types
 * its body as v1's `ProfileUpdatePayload`, whose `call_to_bar_year` is
 * `number | undefined` because v1 could never clear a field. This form can, and
 * a cleared year is `null` (see `ProfileSavePayload`), so the request is typed
 * here rather than casting a lie past v1's signature. Same endpoint, same
 * axios client, same verb: nothing about v1 changes.
 *
 * The avatar calls are NOT restated. `profileApi.uploadAvatar` and
 * `profileApi.deleteAvatar` already carry the right types and are in daily use,
 * so both v1 and v2 keep calling exactly those.
 */
export async function updateProfile(
  payload: ProfileSavePayload,
): Promise<ApiResponse<User>> {
  const response = await apiClient.put<ApiResponse<User>>('/profile', payload);
  return response.data;
}

/**
 * One row of the profession list backend serves from `GET /professions`
 * (af35312, 23 September 2026). The list is ordered already and "Other" is the
 * one row with `is_other`.
 *
 * THE SLUG IS WHAT IS STORED, NOT THE NAME. Five readers in this app check
 * `profession === 'student'`, and the old onboarding list stored underscore
 * slugs, so backend made its slugs underscores to match the column exactly.
 * Anything stored that is not a slug on this list is free text typed under
 * Other.
 */
export interface Profession {
  name: string;
  slug: string;
  is_other: boolean;
}

export async function fetchProfessions(): Promise<Profession[]> {
  const response =
    await apiClient.get<ApiResponse<Profession[]>>('/professions');
  return response.data.data ?? [];
}
