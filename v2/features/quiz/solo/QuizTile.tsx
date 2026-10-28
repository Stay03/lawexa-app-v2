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

/**
 * A quiz's play button in the tile's colour, raised on a deeper shade of it
 * (Arthur, 28 October 2026: colour on the card's tile and play button only).
 */
export const QUIZ_TONE_PLAY: Readonly<Record<QuizTone, string>> = {
  blue: 'bg-[oklch(0.62_0.17_255)] text-white [--lip:oklch(0.47_0.15_255)]',
  gold: 'bg-primary text-primary-foreground [--lip:var(--solo-gold-deep)]',
  coral: 'bg-[oklch(0.68_0.19_35)] text-white [--lip:oklch(0.5_0.16_35)]',
  green: 'bg-[oklch(0.72_0.15_158)] text-white [--lip:oklch(0.5_0.12_158)]',
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
