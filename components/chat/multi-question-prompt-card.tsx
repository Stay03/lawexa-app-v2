'use client';

import { useCallback, useRef, useState } from 'react';
import { ListChecks } from 'lucide-react';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChatContext } from '@/lib/contexts/chat-context';
import { NotificationNudge } from '@/components/chat/notification-nudge';
import type { MultiQuestionPromptInfo } from '@/lib/utils/parse-content-xml';

interface MultiQuestionPromptCardProps {
  prompt: MultiQuestionPromptInfo;
}

export function MultiQuestionPromptCard({ prompt }: MultiQuestionPromptCardProps) {
  const [clicked, setClicked] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatContext = useChatContext();

  const handleAction = (label: string) => {
    setClicked(true);
    chatContext?.sendMessage(label);
  };

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  }, []);

  const showFade = prompt.questions.length > 8;

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <ListChecks className="size-4 text-primary" />
          {prompt.title}
          <Badge variant="secondary" className="ml-auto text-xs font-normal">
            {prompt.questions.length} questions
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-sm text-muted-foreground">{prompt.description}</p>
        </div>

        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="max-h-[240px] space-y-1 overflow-y-auto pr-1"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'hsl(var(--border)) transparent',
            }}
          >
            {prompt.questions.map((q) => (
              <div
                key={q.index}
                className="flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-input/30 text-[11px] font-medium tabular-nums">
                  {q.index}
                </span>
                <p className="text-sm leading-snug">{q.summary}</p>
              </div>
            ))}
          </div>
          {showFade && !isAtBottom && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 rounded-b-md bg-gradient-to-t from-card to-transparent"
              aria-hidden="true"
            />
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          {prompt.actions.map((action) => (
            <Button
              key={action.id}
              variant={action.id === 'begin' ? 'default' : 'outline'}
              size="sm"
              disabled={clicked || chatContext?.isStreaming}
              onClick={() => handleAction(action.label)}
            >
              {action.label}
            </Button>
          ))}
        </div>
        <NotificationNudge />
      </CardFooter>
    </Card>
  );
}
