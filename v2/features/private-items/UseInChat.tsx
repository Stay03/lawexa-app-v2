'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { MessageSquarePlus, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PrivateItemKind } from '@/types/private-items';
import { spacesQueries } from '@/v2/features/spaces/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { sharedAnswerLine } from './pages-model';

/**
 * Use in chat (Arthur's pages, 19 November 2026): where to use one of your
 * own templates or skills. A new chat of your own, or one of your Spaces. The
 * message you send there carries the item (`use_items`), so Lawexa uses it
 * with no ask card; in a Space that press is your own "just this time", and
 * the line under the choice says the answer is shared (Techlead, 19 November
 * 2026), because the ask card was where an owner learned it.
 */
export function UseInChat({
  kind,
  uuid,
  name,
  open,
  onClose,
}: {
  kind: PrivateItemKind;
  uuid: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const session = useV2Session();
  const spaces = useQuery({ ...spacesQueries.list({ viewerId: session.userId }), enabled: open });
  const [target, setTarget] = useState<string>('mine');
  const inSpace = target !== 'mine';
  const use = `${kind}:${uuid}`;

  const start = () => {
    onClose();
    router.push(inSpace ? `/spaces/${target}?use=${encodeURIComponent(use)}` : `/?use=${encodeURIComponent(use)}`);
  };

  const option = (value: string, title: string, sub: string, icon: React.ReactNode) => (
    <button
      key={value}
      type="button"
      role="radio"
      aria-checked={target === value}
      onClick={() => setTarget(value)}
      className={cn(
        'v2-interactive flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
        target === value ? 'border-primary bg-accent/60' : 'border-border hover:bg-muted/60',
      )}
    >
      <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={(next) => (next ? undefined : onClose())}
      size="content"
      className="md:max-w-md"
      title="Use in chat"
      description={name}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={start}>
            <MessageSquarePlus aria-hidden className="size-4" />
            {inSpace ? 'Open the Space' : 'Start a chat'}
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Where to use it" className="flex flex-col gap-2">
        {option('mine', 'A new chat', 'Only you see it', <MessageSquarePlus className="size-4" />)}
        {(spaces.data?.data ?? []).slice(0, 4).map((space) =>
          option(space.uuid, space.name, `${space.active_members_count} members`, <Users className="size-4" />),
        )}
      </div>
      {inSpace ? (
        <p role="note" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] leading-snug text-amber-900 dark:bg-amber-400/10 dark:text-amber-200">
          {sharedAnswerLine(kind)}
        </p>
      ) : (
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
          {kind === 'template' ? 'Lawexa drafts from this template and asks you for the blanks it cannot fill.' : 'Lawexa follows these steps for your next message.'}
        </p>
      )}
    </ResponsiveOverlay>
  );
}
