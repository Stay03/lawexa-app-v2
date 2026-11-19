'use client';

import { useQuery } from '@tanstack/react-query';
import { FileText, Loader2, Lock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { PrivateItemChoice, PrivateItemRequest, UsedPrivateItem } from '@/types/private-items';
import { useV2ChatContext } from '@/v2/features/conversations/conversation/chat-context';
import { useV2Session } from '@/v2/runtime/session-context';
import { usedItemLine } from './model';
import { privateItemsQueries, useAnswerRequest } from './queries';

const CHOICES: readonly { choice: PrivateItemChoice; label: string }[] = [
  { choice: 'once', label: 'Just this time' },
  { choice: 'always', label: 'Always in this Space' },
  { choice: 'no', label: 'No' },
];

/**
 * Lawexa asks before it uses one of the owner's own templates or skills in a
 * Space chat (Stay, thread 9ae498ae, 19 November 2026). The turn has ended
 * with a short reply that names nothing; this card sits under it on the
 * owner's screen only, because only the owner's read of the requests returns
 * them. "Always in this Space" covers the owner's own messages in that Space,
 * and only the owner can take it back (My templates and My skills).
 *
 * A yes starts a new turn on the server, and the chat follows its stream, as
 * after the machine's Done. A request left for 24 hours expires.
 */
export function PrivateItemAsk({ requestIds }: { requestIds: readonly string[] }) {
  const chat = useV2ChatContext();
  const conversationId = chat?.conversationId ?? '';
  const read = useQuery(privateItemsQueries.chatRequests(conversationId, conversationId !== '' && requestIds.length > 0));
  const answer = useAnswerRequest(conversationId);
  const pending = (read.data ?? []).filter(
    (request) => request.status === 'pending' && requestIds.includes(request.uuid),
  );
  if (pending.length === 0) return null;

  const choose = (request: PrivateItemRequest, choice: PrivateItemChoice) =>
    answer.mutate(
      { uuid: request.uuid, choice },
      {
        onSuccess: (result) => {
          if (result.resumed?.execution_id) chat?.followResumedTurn(result.resumed.execution_id);
        },
        onError: (error) => toast.error(extractApiError(error).message),
      },
    );

  return (
    <section
      aria-label="Lawexa asks before using your own items"
      className="mt-3 overflow-hidden rounded-2xl border border-primary/30 bg-card motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <ul className="divide-y divide-border/70">
        {pending.map((request) => {
          const Icon = request.item.kind === 'template' ? FileText : Sparkles;
          const busy = answer.isPending && answer.variables?.uuid === request.uuid;
          return (
            <li key={request.uuid} className="flex flex-col gap-2.5 p-3.5">
              <p className="flex items-start gap-2.5 text-sm leading-snug font-medium text-foreground">
                <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                Use my {request.item.name} {request.item.kind} here?
              </p>
              <div className="flex flex-wrap gap-2">
                {CHOICES.map(({ choice, label }) => (
                  <Button
                    key={choice}
                    type="button"
                    size="sm"
                    variant={choice === 'once' ? 'default' : choice === 'always' ? 'secondary' : 'ghost'}
                    disabled={answer.isPending}
                    onClick={() => choose(request, choice)}
                  >
                    {busy && answer.variables?.choice === choice ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
                    {label}
                  </Button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-1.5 border-t border-border/70 bg-muted/40 px-3.5 py-2 text-xs text-muted-foreground">
        <Lock aria-hidden className="size-3 shrink-0" />
        Only you see this. Others see Lawexa&rsquo;s answer, not your {pending.length === 1 ? pending[0].item.kind : 'items'}.
      </p>
    </section>
  );
}

/** "Used a template from Ada" under an answer; the owner reads "Used your Tenancy notice template". */
export function UsedItemsLine({ items }: { items: readonly UsedPrivateItem[] }) {
  const { userUuid } = useV2Session();
  if (items.length === 0) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map((item, index) => {
        const Icon = item.kind === 'template' ? FileText : Sparkles;
        return (
          <span key={`${item.owner.uuid}-${item.kind}-${index}`} className="inline-flex items-center gap-1.5">
            <Icon aria-hidden className="size-3" />
            {usedItemLine(item, userUuid)}
          </span>
        );
      })}
    </p>
  );
}
