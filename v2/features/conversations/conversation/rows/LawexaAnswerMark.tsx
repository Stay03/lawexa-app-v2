import { LogoMark } from '@/v2/shell/Logo';
import { clockTime } from '../day-label';

/**
 * The line above an answer in a space chat: Lawexa's mark, its name and the
 * time (Arthur, 14 October 2026: "Clear attribution for AI responses"). Among
 * several people's questions, the answer says plainly that Lawexa wrote it. A
 * personal chat, where every answer is Lawexa's, has no line.
 */
export function LawexaAnswerMark({ time }: { time: Date }) {
  const at = clockTime(time);
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <LogoMark className="size-5 shrink-0" alt="" />
      <span aria-hidden className="text-sm font-medium">
        Lawexa
      </span>
      <span aria-hidden className="text-muted-foreground text-xs tabular-nums">
        {at}
      </span>
      <span className="sr-only">Lawexa&apos;s answer, at {at}</span>
    </div>
  );
}
