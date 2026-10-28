import { cn } from '@/lib/utils';
import { quizInitial, quizTone, type QuizTone } from './rows-model';

/**
 * QuizTile — a quiz's face in the lists: its first letter on one of four B1
 * colours, raised on a small lip, the same quiz always the same colour
 * (`quizTone`). Decorative: the card's title says what it is. `sm` is the
 * small-card grid's (28px); `md` the larger face.
 */

const TONE: Readonly<Record<QuizTone, string>> = {
  blue: 'bg-[oklch(0.62_0.17_255)] text-[oklch(0.2_0.05_255)]',
  gold: 'bg-primary text-primary-foreground',
  coral: 'bg-[oklch(0.68_0.19_35)] text-[oklch(0.22_0.06_35)]',
  green: 'bg-[oklch(0.72_0.15_158)] text-[oklch(0.22_0.05_158)]',
};

const SIZE = {
  sm: 'size-7 rounded-lg text-xs shadow-[0_2px_0_rgb(0_0_0/0.45)]',
  md: 'size-11 rounded-[14px] text-base shadow-[0_3px_0_rgb(0_0_0/0.45)]',
} as const;

export function QuizTile({
  uuid,
  title,
  size = 'md',
  className,
}: {
  uuid: string;
  title: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'font-comfortaa flex shrink-0 items-center justify-center font-bold',
        SIZE[size],
        TONE[quizTone(uuid)],
        className,
      )}
    >
      {quizInitial(title)}
    </span>
  );
}
