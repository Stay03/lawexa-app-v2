'use client';

import {
  GraduationCap,
  Scale,
  Telescope,
  ListChecks,
  FileText,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeneratingElement } from '@/lib/utils/parse-content-xml';

const ELEMENT_META: Record<GeneratingElement, { icon: LucideIcon; label: string }> = {
  quiz: { icon: GraduationCap, label: 'Building quiz' },
  lawyers: { icon: Scale, label: 'Finding lawyers' },
  deep_research: { icon: Telescope, label: 'Preparing research' },
  execution_plan: { icon: ListChecks, label: 'Planning' },
  multi_question: { icon: ListChecks, label: 'Preparing questions' },
  note_link: { icon: FileText, label: 'Preparing note' },
};

const FALLBACK = { icon: Sparkles, label: 'Generating' };

/**
 * Minimal streaming placeholder shown while a special element (quiz, lawyer card,
 * etc.) is still being generated — an element icon plus a shimmering label, no
 * border, so it reads as inline activity rather than a card. Swaps to the real
 * card the moment the closing tag arrives.
 */
export function GeneratingIndicator({
  element,
  className,
}: {
  element: GeneratingElement;
  className?: string;
}) {
  const meta = ELEMENT_META[element] ?? FALLBACK;
  const Icon = meta.icon;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-1.5 text-sm', className)}
    >
      <Icon className="h-4 w-4 shrink-0 animate-pulse text-muted-foreground" aria-hidden />
      <span className="text-shimmer font-medium">{meta.label}…</span>
    </span>
  );
}
