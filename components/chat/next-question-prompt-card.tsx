'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useChatContext } from '@/lib/contexts/chat-context';
import { NotificationNudge } from '@/components/chat/notification-nudge';
import type { NextQuestionPromptInfo } from '@/lib/utils/parse-content-xml';

interface NextQuestionPromptCardProps {
  prompt: NextQuestionPromptInfo;
}

export function NextQuestionPromptCard({ prompt }: NextQuestionPromptCardProps) {
  const [clicked, setClicked] = useState(false);
  const chatContext = useChatContext();

  const handleAction = (label: string) => {
    setClicked(true);
    chatContext?.sendMessage(label);
  };

  const progressPercent = Math.round((prompt.current / prompt.total) * 100);

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <ArrowRight className="size-4 text-primary" />
          Question {prompt.current} of {prompt.total} answered
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Next Question
          </p>
          <p className="text-sm">{prompt.nextSummary}</p>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2">
        <div className="flex gap-2 w-full">
          {prompt.actions.map((action) => (
            <Button
              key={action.id}
              variant={action.id === 'next' ? 'default' : 'outline'}
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
