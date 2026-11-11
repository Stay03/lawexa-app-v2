import Link from 'next/link';

import { cn } from '@/lib/utils';

const TABS = [
  { id: 'templates', label: 'Designs', href: '/admin/certificates/templates' },
  { id: 'programmes', label: 'Programmes', href: '/admin/certificates/programmes' },
] as const;

/** The two halves of certificates admin: designs, and the programmes that issue them. */
export function CertificatesTabs({ active }: { active: (typeof TABS)[number]['id'] }) {
  return (
    <nav aria-label="Certificates" className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          aria-current={tab.id === active ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            tab.id === active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
