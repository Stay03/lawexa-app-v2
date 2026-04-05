'use client';

import { useState } from 'react';
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
import type { MultiQuestionPromptInfo } from '@/lib/utils/parse-content-xml';

interface MultiQuestionPromptCardProps {
  prompt: MultiQuestionPromptInfo;
}

export function MultiQuestionPromptCard({ prompt }: MultiQuestionPromptCardProps) {
  const [clicked, setClicked] = useState(false);
  const chatContext = useChatContext();

  const handleAction = (label: string) => {
    setClicked(true);
    chatContext?.sendMessage(label);
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <ListChecks className="size-4 text-primary" />
          {prompt.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{prompt.description}</p>

        <div className="space-y-2">
          {prompt.questions.map((q) => (
            <div key={q.index} className="flex items-start gap-3">
              <Badge
                variant="outline"
                className="mt-0.5 shrink-0 tabular-nums"
              >
                {q.index}
              </Badge>
              <p className="text-sm">{q.summary}</p>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
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
      </CardFooter>
    </Card>
  );
}
