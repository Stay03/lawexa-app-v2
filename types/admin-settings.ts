export type AdminSettingType = 'boolean' | 'integer' | 'string' | 'json';

export type AdminSettingGroup =
  | 'trial'
  | 'limits'
  | 'marketplace'
  | 'subscription'
  | 'auth'
  | 'feedback'
  | 'trending'
  | 'rate_limits';

export const BILLING_SETTING_GROUPS: AdminSettingGroup[] = [
  'subscription',
  'trial',
  'limits',
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
