import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * Admin › AI › Skills has two lists: the skills, and the drafts waiting to
 * become skills (the skills tool, thread 2b436b4f). Links, not a client-side
 * tab, so each list has its own address and the back button works.
 */
export function SkillsTabs({ active }: { active: 'skills' | 'drafts' }) {
  const tab = (key: 'skills' | 'drafts', href: string, label: string) => (
    <Link
      href={href}
      aria-current={active === key ? 'page' : undefined}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
        active === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="AI Skills" className="inline-flex rounded-lg bg-muted p-1">
      {tab('skills', '/admin/ai/skills', 'Skills')}
      {tab('drafts', '/admin/ai/skills/drafts', 'Drafts')}
    </nav>
  );
}
