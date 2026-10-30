'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { EXPLORE_BASE, EXPLORE_SECTIONS, STUDY_HOME, exploreSection, quizAreaTab } from './model';

/**
 * The admin Quiz area's two tabs (Stay's option A, 30 October 2026, thread
 * e80a3d30): the old study quizzes and the new Explore quizzes. They are links,
 * not in-page tabs, because each side is a group of pages; the look is the
 * admin user page's underline tabs.
 */
const AREA_TABS = [
  { id: 'study', label: 'Study quizzes (old)', href: STUDY_HOME },
  { id: 'explore', label: 'Explore quizzes (new)', href: EXPLORE_BASE },
] as const;

const tabClass = (active: boolean) =>
  cn(
    '-mb-px flex-none border-b-2 px-1 pb-3 pt-2 text-sm font-medium transition-colors',
    active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
  );

export function AdminQuizAreaTabs() {
  const pathname = usePathname();
  const current = quizAreaTab(pathname);
  return (
    <nav aria-label="Quiz area" className="flex gap-6 overflow-x-auto border-b [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {AREA_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={current === tab.id ? 'page' : undefined}
          className={tabClass(current === tab.id)}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** The new tab's three views: Plays, Quizzes and Totals. A play opens under Plays, a quiz under Quizzes. */
export function AdminExploreSectionTabs() {
  const pathname = usePathname();
  const current = exploreSection(pathname);
  return (
    <nav aria-label="Explore quizzes" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
      {EXPLORE_SECTIONS.map((section) => (
        <Link
          key={section.id}
          href={section.href}
          aria-current={current === section.id ? 'page' : undefined}
          className={cn(
            'flex-none rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            current === section.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
