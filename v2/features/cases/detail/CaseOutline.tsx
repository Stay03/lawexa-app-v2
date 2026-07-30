'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { FOCUS_RING } from '@/v2/shell/designs/modules';

/**
 * CaseOutline — the "On this page" rail beside the document on wide screens.
 *
 * WHY. An enriched judgment is LONG: eight numbered principles, a full
 * facts-and-held summary, and sixty citation rows put "About this case" many
 * screens below the title. The rail is the map: it names the parts, marks
 * where you are, and jumps on click. It exists only ≥90rem (where the shell
 * has true dead margin beside the reading column), so it never competes with
 * the text — narrower screens keep the section headings as their wayfinding.
 *
 * HOW THE SPY WORKS. One IntersectionObserver against the viewport with a
 * band rootMargin: a section is "current" while any part of it crosses the
 * upper reading band. Several can cross at once around short sections, so the
 * FIRST in document order wins. The observer only ever runs on wide screens
 * (the rail is `display: none` otherwise — but the effect is cheap either
 * way).
 *
 * Buttons, not hash links: a hash write per click would stack history entries
 * the back button then has to chew through — jumping within one page is not a
 * navigation. Scrolling honours `prefers-reduced-motion`.
 */

export interface OutlineSection {
  id: string;
  label: string;
}

export function CaseOutline({ sections }: { sections: OutlineSection[] }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  // Live set of sections currently crossing the reading band.
  const crossingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const targets = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossingRef.current.add(entry.target.id);
          else crossingRef.current.delete(entry.target.id);
        }
        const current = sections.find((s) => crossingRef.current.has(s.id));
        // Between sections nothing crosses the band — keep the last answer
        // rather than flickering to none.
        if (current) setActive(current.id);
      },
      // The reading band: the zone from 15% to 30% down the viewport.
      { rootMargin: '-15% 0px -70% 0px' },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <nav aria-label="On this page" className="flex flex-col gap-2">
      <p className="doc-kicker">On this page</p>
      <ul className="flex flex-col border-l border-border/60">
        {sections.map((section) => {
          const isActive = active === section.id;
          return (
            <li key={section.id} className="relative">
              {isActive ? (
                <span
                  aria-hidden
                  className="absolute inset-y-1.5 -left-px w-0.5 rounded-full bg-primary"
                />
              ) : null}
              <button
                type="button"
                onClick={() => jump(section.id)}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'v2-interactive block w-full rounded-r-md py-1.5 pl-3.5 pr-2 text-left text-xs transition-colors',
                  isActive
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                {section.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
