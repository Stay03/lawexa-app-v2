export type AdminSettingType = 'boolean' | 'integer' | 'string' | 'json';

export type AdminSettingGroup =
  | 'trial'
  | 'limits'
  | 'marketplace'
  | 'subscription'
  | 'auth'
  | 'feedback'
  | 'trending'
  | 'rate_limits'
  | 'pricing';

/* Drives the render order on the billing settings screen. A group missing from
   here is fetched and then silently not shown, which is how five live pricing
   values sat in the database and on no screen. */
export const BILLING_SETTING_GROUPS: AdminSettingGroup[] = [
  'subscription',
  'trial',
  'pricing',
];

export interface AdminSetting {
  key: string;
  value: boolean | number | string | Record<string, unknown> | unknown[];
  type: AdminSettingType;
  group: AdminSettingGroup;
  description: string | null;
  is_public: boolean;
  updated_at: string;
}

export interface AdminSettingsListResponse {
  success: boolean;
  message: string;
  data: AdminSetting[];
}

export interface AdminSettingsUpdatePayload {
  settings: Record<string, string | number | boolean>;
}

export interface AdminSettingsUpdateResponse {
  success: boolean;
  message: string;
  data: AdminSetting[];
}

export interface AdminSettingsParams {
  group?: AdminSettingGroup;
}
