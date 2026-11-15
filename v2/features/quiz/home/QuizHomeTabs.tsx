'use client';

import { cn } from '@/lib/utils';
import { TabRow } from '@/v2/shell/TabRow';
import type { QuizHomeTab } from './quiz-home-tab';

/**
 * The Quiz home's two tabs — Explore | My quizzes — on the shared `TabRow`
 * primitive, drawn like the notes and cases strips, so every Library list
 * switches the same way. Explore first: it is the tab anyone can open.
 */

const QUIZ_HOME_TABS: readonly { id: QuizHomeTab; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'mine', label: 'My quizzes' },
];

export function QuizHomeTabs({
  value,
  onChange,
  panelId,
}: {
  value: QuizHomeTab;
  onChange: (next: QuizHomeTab) => void;
  /** The host's single `role="tabpanel"` id — wires `aria-controls` back. */
  panelId: string;
}) {
  return (
    <TabRow
      tabs={QUIZ_HOME_TABS}
      value={value}
      onChange={onChange}
      ariaLabel="Choose which quizzes to show"
      panelId={panelId}
      className="flex w-full items-end gap-6 overflow-x-auto overscroll-x-contain border-b border-border"
      tabClassName={(selected) =>
        cn(
          'v2-interactive relative -mb-px min-h-11 shrink-0 border-b-2 text-[15px] font-semibold transition-colors duration-150 motion-reduce:transition-none',
          selected ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
        )
      }
    >
      {(tab) => tab.label}
    </TabRow>
  );
}
