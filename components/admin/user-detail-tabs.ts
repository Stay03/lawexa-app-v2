/** Tab identifiers for the admin User Details page (kept in one place so the
 *  page, the URL `?tab=` sync, and the in-page "View all" links agree). */
export const ADMIN_USER_TABS = [
  'overview',
  'activity',
  'quiz',
  'conversations',
  'profile',
] as const;

export type AdminUserTab = (typeof ADMIN_USER_TABS)[number];

export const ADMIN_USER_TAB_LABELS: Record<AdminUserTab, string> = {
  overview: 'Overview',
  activity: 'Activity',
  quiz: 'Quiz',
  conversations: 'Conversations',
  profile: 'Profile',
};

export function isAdminUserTab(value: string | null): value is AdminUserTab {
  return value != null && (ADMIN_USER_TABS as readonly string[]).includes(value);
}
