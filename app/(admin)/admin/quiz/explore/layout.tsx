import type { ReactNode } from 'react';
import { AdminExploreSectionTabs } from '@/components/admin/channel-quiz/AdminQuizAreaTabs';

/** The Explore quizzes (new) tab: Plays, Quizzes and Totals over each of its pages. */
export default function AdminExploreQuizzesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <AdminExploreSectionTabs />
      {children}
    </div>
  );
}
