'use client';

import { useState } from 'react';
import { Brain } from 'lucide-react';

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
import type { DeepResearchPromptInfo } from '@/lib/utils/parse-content-xml';

interface DeepResearchPromptCardProps {
  prompt: DeepResearchPromptInfo;
}

export function DeepResearchPromptCard({ prompt }: DeepResearchPromptCardProps) {
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
          <Brain className="size-4 text-primary" />
          {prompt.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{prompt.message}</p>

        <div className="rounded-lg bg-muted/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Query Summary
          </p>
          <p className="text-sm">{prompt.querySummary}</p>
        </div>

        {prompt.estimatedSources.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {prompt.estimatedSources.map((source) => (
              <Badge key={source} variant="outline">
                {source}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        {prompt.actions.map((action) => (
          <Button
            key={action.id}
            variant={action.id === 'confirm' ? 'default' : 'outline'}
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
