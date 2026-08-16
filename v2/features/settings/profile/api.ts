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
