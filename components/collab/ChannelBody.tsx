'use client';

import { useState } from 'react';
import { Files, ListChecks, MessagesSquare } from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChannelRealtime } from '@/lib/hooks/useChannelRealtime';
import { cn } from '@/lib/utils';
import type { Channel } from '@/types/collab';

import { ChannelConversation } from './ChannelConversation';
import { FilesPanel } from './files/FilesPanel';
import { ListsPanel } from './lists/ListsPanel';

type ChannelTab = 'chat' | 'lists' | 'files';

interface ChannelBodyProps {
  channel: Channel;
  realtime: ChannelRealtime;
  className?: string;
}

const TABS: ReadonlyArray<{
  value: ChannelTab;
  label: string;
  icon: typeof MessagesSquare;
}> = [
  { value: 'chat', label: 'Chat', icon: MessagesSquare },
  { value: 'lists', label: 'Lists', icon: ListChecks },
  { value: 'files', label: 'Files', icon: Files },
];

/**
 * The member-facing channel body: a Chat / Lists / Files tab shell.
 *
 * Chat stays mounted across tab switches (`forceMount`) so its scroll position
 * and the live message stream survive a detour to Lists or Files — Radix hides
 * the inactive Chat panel via a `hidden` attribute rather than unmounting it.
 * Lists and Files mount lazily on first activation (default `TabsContent`
 * behaviour) and read from the React Query cache, so remounting them is cheap.
 *
 * The active tab is NOT reset via an effect: `ChannelView` keys this component
 * by `channel.uuid`, so switching channels remounts it fresh on Chat — keeping
 * the render clean of the setState-in-effect the repo's lint forbids.
 *
 * Non-members never reach this component; `ChannelView` renders
 * `ChannelConversation` directly for them so the join flow is untouched.
 */
export function ChannelBody({ channel, realtime, className }: ChannelBodyProps) {
  const [tab, setTab] = useState<ChannelTab>('chat');

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as ChannelTab)}
      className={cn('min-h-0 gap-0', className)}
    >
      <div className="shrink-0 border-b px-4">
        <div className="mx-auto w-full max-w-3xl">
          <TabsList
            variant="line"
            aria-label="Channel sections"
            className="h-11 w-fit gap-4 bg-transparent p-0"
          >
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-11 flex-none rounded-none px-0.5 text-muted-foreground data-active:text-foreground [&_svg]:size-4"
              >
                <Icon aria-hidden />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </div>

      {/* Chat is force-mounted so its scroll position and live stream persist
          across tab switches; when inactive Radix adds `hidden`, dropping it
          from the flex flow so the active panel fills the region. */}
      <TabsContent
        value="chat"
        forceMount
        className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
      >
        <ChannelConversation
          channel={channel}
          realtime={realtime}
          className="min-h-0 flex-1"
        />
      </TabsContent>

      <TabsContent
        value="lists"
        className="mt-0 flex min-h-0 flex-1 flex-col"
      >
        <ListsPanel channel={channel} className="min-h-0 flex-1" />
      </TabsContent>

      <TabsContent
        value="files"
        className="mt-0 flex min-h-0 flex-1 flex-col"
      >
        <FilesPanel channel={channel} className="min-h-0 flex-1" />
      </TabsContent>
    </Tabs>
  );
}
