'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { feedbackApi } from '@/lib/api/feedback';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ChatRating, ChatRatingReason } from '@/types/feedback';
import { useV2Session } from '@/v2/runtime/session-context';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { CHAT_RATING_QUESTION, CHAT_RATING_TEXT_MAX, POOR_REASONS, mayOffer, reasonReady } from './model';
import {
  beginOffer,
  currentMomentSeq,
  endOffer,
  noteAnswerStreaming,
  useActiveOffer,
  useAskedThisSession,
  useChatMoment,
  useQuizUnderWay,
  type ActiveOffer,
} from './store';

/**
 * ChatRatingSlot — where "How is Lawexa doing?" appears: above a chat's
 * message box (the ChatDock, which is every chat's box, a Space chat's
 * included). It decides when (`mayOffer`), asks the server only once a moment
 * has happened in this chat, and reports the banner as shown the moment it
 * appears. The banner itself is `ChatRatingBanner`.
 */
export function ChatRatingSlot({ conversationId, isStreaming }: { conversationId: string; isStreaming: boolean }) {
  const { signedIn, role, userId } = useV2Session();
  const isAccount = signedIn && role !== null && role !== 'guest' && role !== 'bot';
  // Only moments after this box appeared are about this chat.
  const [seqAtMount] = useState(currentMomentSeq);
  const moment = useChatMoment();
  const askedThisSession = useAskedThisSession();
  const quizInProgress = useQuizUnderWay();
  const active = useActiveOffer();
  const hasMoment = moment !== null && moment.seq > seqAtMount;

  // The server's answer (14 days, new user), asked once a session, and only
  // after a moment: most chats never need it.
  const prompt = useQuery({
    queryKey: ['chat-rating', 'prompt', userId],
    queryFn: () => feedbackApi.chatPrompt(),
    enabled: isAccount && hasMoment && !askedThisSession,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    meta: { silentError: true },
  });

  const offerNow = mayOffer({
    isAccount,
    eligible: prompt.data ? prompt.data.eligible : null,
    askedThisSession,
    isStreaming,
    quizInProgress,
    moment,
    seqAtMount,
  });

  // Ask again waits for its new answer: tell the moment once it is being written.
  useEffect(() => {
    if (isStreaming) noteAnswerStreaming();
  }, [isStreaming]);

  // The banner appears: the session's one ask, reported as shown, which
  // starts the 14 days whether or not the reader answers (Arthur, choice 2).
  useEffect(() => {
    if (offerNow && beginOffer(conversationId)) {
      void feedbackApi.chatPromptSeen('shown').catch(() => undefined);
    }
  }, [offerNow, conversationId]);

  // An offer from another chat is not about this one: it ends quietly (it
  // was already reported as shown).
  useEffect(() => {
    if (active && active.conversationId !== conversationId) endOffer();
  }, [active, conversationId]);

  if (!active || active.conversationId !== conversationId) return null;
  return <ChatRatingBanner key={active.seq} offer={active} />;
}

type Phase =
  | { kind: 'ask' }
  | { kind: 'reasons'; reason: ChatRatingReason | null; text: string }
  | { kind: 'thanks' };

/** How long "Thanks" stays before the banner leaves. */
const THANKS_MS = 2200;
/** The leave transition, matched to `duration-200` below. */
const LEAVE_MS = 200;

const CARD = 'rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg';
const PILL = cn(
  'v2-interactive inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50',
  FOCUS_RING,
);

/**
 * The banner: Poor · Fine · Great and a close. Fine and Great say thanks and
 * go; Poor asks "What went wrong?" with one-tap answers, and "Something
 * else" opens a text box. Inline above the message box, never a modal, so
 * the answer it is about stays in view.
 */
export function ChatRatingBanner({ offer }: { offer: ActiveOffer }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' });
  const [leaving, setLeaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const leave = (after: number) => {
    timers.current.push(
      setTimeout(() => setLeaving(true), after),
      setTimeout(endOffer, after + LEAVE_MS),
    );
  };

  const rate = useMutation({
    mutationFn: (input: { rating: ChatRating; reason?: ChatRatingReason; text?: string }) =>
      feedbackApi.submitChatRating({
        ...input,
        conversationId: offer.conversationId,
        messageId: offer.messageId,
        trigger: offer.trigger,
      }),
    meta: { silentError: true },
    onMutate: () => setFailed(false),
    onSuccess: () => {
      setPhase({ kind: 'thanks' });
      leave(THANKS_MS);
    },
    onError: () => setFailed(true),
  });

  const close = () => {
    void feedbackApi.chatPromptSeen('closed').catch(() => undefined);
    leave(0);
  };

  return (
    <div
      role="region"
      aria-label={CHAT_RATING_QUESTION}
      className={cn(
        CARD,
        'mb-2 px-3.5 py-3 transition-[opacity,transform] duration-200 motion-reduce:transition-none',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
        leaving && 'translate-y-1 opacity-0',
      )}
    >
      {phase.kind === 'thanks' ? (
        <p role="status" className="py-1 text-center text-sm font-medium">
          Thanks for telling us.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {phase.kind === 'ask' ? CHAT_RATING_QUESTION : 'What went wrong?'}
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className={cn(
                'v2-interactive -mr-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
                FOCUS_RING,
              )}
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          {phase.kind === 'ask' ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className={PILL}
                disabled={rate.isPending}
                onClick={() => setPhase({ kind: 'reasons', reason: null, text: '' })}
              >
                Poor
              </button>
              {(['fine', 'great'] as const).map((rating) => (
                <button
                  key={rating}
                  type="button"
                  className={PILL}
                  disabled={rate.isPending}
                  onClick={() => rate.mutate({ rating })}
                >
                  {rate.isPending && rate.variables?.rating === rating ? (
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                  ) : rating === 'fine' ? (
                    'Fine'
                  ) : (
                    'Great'
                  )}
                </button>
              ))}
            </div>
          ) : (
            <PoorReasons
              phase={phase}
              sending={rate.isPending}
              onPick={(reason) => {
                if (reason === 'something_else') setPhase({ ...phase, reason });
                else rate.mutate({ rating: 'poor', reason });
              }}
              onText={(text) => setPhase({ ...phase, text })}
              onSend={() => rate.mutate({ rating: 'poor', reason: 'something_else', text: phase.text.trim() })}
            />
          )}

          {failed ? (
            <p role="alert" className="mt-2 text-xs text-destructive">
              Couldn&rsquo;t send that. Try again.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Poor's reasons: one tap sends, except "Something else", which asks for words. */
function PoorReasons({
  phase,
  sending,
  onPick,
  onText,
  onSend,
}: {
  phase: { kind: 'reasons'; reason: ChatRatingReason | null; text: string };
  sending: boolean;
  onPick: (reason: ChatRatingReason) => void;
  onText: (text: string) => void;
  onSend: () => void;
}) {
  const writing = phase.reason === 'something_else';
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {POOR_REASONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            disabled={sending}
            aria-pressed={phase.reason === key}
            onClick={() => onPick(key)}
            className={cn(
              'v2-interactive inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-50',
              phase.reason === key
                ? 'border-foreground bg-foreground text-background'
                : 'border-border hover:bg-secondary',
              FOCUS_RING,
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {writing ? (
        <div className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          <Textarea
            autoFocus
            rows={2}
            maxLength={CHAT_RATING_TEXT_MAX}
            value={phase.text}
            onChange={(event) => onText(event.target.value)}
            placeholder="Tell us what went wrong"
            aria-label="What went wrong"
            className="min-h-16 resize-none text-base sm:text-sm"
          />
          <Button
            type="button"
            size="sm"
            className="self-end"
            disabled={sending || !reasonReady(phase.reason, phase.text)}
            onClick={onSend}
          >
            {sending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Send
          </Button>
        </div>
      ) : null}
    </div>
  );
}
