import { apiClient } from '@/lib/api/client';
import type { ApiResponse } from '@/types/api';
import type { PushDeviceResponse } from '@/types/push';

export const pushApi = {
  // Register/upsert this device's FCM token. Idempotent by token: re-registering
  // your own reactivates it; registering one held by someone else reassigns it to
  // you (shared-device rule). 200/201. Server rejects tokens outside 100–512 chars.
  register: async (
    token: string,
    deviceName: string
  ): Promise<PushDeviceResponse> => {
    const response = await apiClient.post<PushDeviceResponse>(
      '/notification-channels/push',
      { token, device_name: deviceName }
    );
    return response.data;
  },

  // Deactivate this device's token on logout/disable. 404 when the token isn't the
  // caller's / unknown — callers treat that as already-gone.
  deactivate: async (token: string): Promise<ApiResponse<null>> => {
    const response = await apiClient.delete<ApiResponse<null>>(
      '/notification-channels/push',
      { data: { token } }
    );
    return response.data;
  },
};
