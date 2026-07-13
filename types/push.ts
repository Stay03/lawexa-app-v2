import type { ApiResponse } from '@/types/api';

/**
 * A registered push device, as returned by `/notification-channels/push`. The
 * full FCM token never round-trips — `destination` is always null for push rows
 * and `token_preview` is only the last 8 chars.
 */
export interface PushDevice {
  uuid: string;
  type: 'push';
  destination: null;
  token_preview: string;
  device_name: string | null;
  active: boolean;
  created_at: string;
}

export type PushDeviceResponse = ApiResponse<PushDevice>;
