import { cn } from '@/lib/utils';
import { quizInitial, quizTone, type QuizTone } from './rows-model';

/**
 * QuizTile — a quiz's face in the lists: its first letter on one of four B1
 * colours, raised on a small lip, the same quiz always the same colour
 * (`quizTone`). Decorative: the row's title says what it is.
 */

const TONE: Readonly<Record<QuizTone, string>> = {
  blue: 'bg-[oklch(0.62_0.17_255)] text-[oklch(0.2_0.05_255)]',
  gold: 'bg-primary text-primary-foreground',
  coral: 'bg-[oklch(0.68_0.19_35)] text-[oklch(0.22_0.06_35)]',
  green: 'bg-[oklch(0.72_0.15_158)] text-[oklch(0.22_0.05_158)]',
};

export function QuizTile({ uuid, title, className }: { uuid: string; title: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-comfortaa flex size-11 shrink-0 items-center justify-center rounded-[14px] text-base font-bold shadow-[0_3px_0_rgb(0_0_0/0.45)]',
        TONE[quizTone(uuid)],
        className,
      )}
    >
      {quizInitial(title)}
    </span>
  );
}
