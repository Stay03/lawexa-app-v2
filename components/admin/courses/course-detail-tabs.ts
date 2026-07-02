/** Tab identifiers for the admin Course detail page (kept in one place so the
 *  page and its URL `?tab=` sync agree). */
export const ADMIN_COURSE_TABS = [
  'cases',
  'quiz-questions',
  'conversations',
] as const;

export type AdminCourseTab = (typeof ADMIN_COURSE_TABS)[number];

export const ADMIN_COURSE_TAB_LABELS: Record<AdminCourseTab, string> = {
  cases: 'Cases',
  'quiz-questions': 'Quiz Questions',
  conversations: 'Conversations',
};

export function isAdminCourseTab(value: string | null): value is AdminCourseTab {
  return (
    value != null && (ADMIN_COURSE_TABS as readonly string[]).includes(value)
  );
}
