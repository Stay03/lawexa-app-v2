import type { ReactNode } from 'react';
import { AdminQuizAreaTabs } from '@/components/admin/channel-quiz/AdminQuizAreaTabs';

/**
 * Every admin Quiz page sits under the area's two tabs, "Study quizzes (old)"
 * and "Explore quizzes (new)" (Stay's option A, 30 October 2026, thread
 * e80a3d30). The old pages themselves do not change.
 */
export default function AdminQuizAreaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <AdminQuizAreaTabs />
      {children}
    </div>
  );
}
