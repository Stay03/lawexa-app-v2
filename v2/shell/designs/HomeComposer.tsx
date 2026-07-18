'use client';

import { useState } from 'react';
import { ArrowUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input';

/**
 * The shimmer composer shared by both home-design stubs — the ORIGINAL
 * `.gold-shimmer` border (the default `PromptInput` variant wraps it), never a
 * reimplementation. Submit is intentionally inert this wave; the real
 * conversation wiring lands in a later phase. Kept as one shared piece so the
 * two lean A/B stubs differ only in their surrounding layout, not the composer.
 */
export function HomeComposer() {
  const [input, setInput] = useState('');

  // Inert this wave.
  const handleSubmit = () => {};

  return (
    <PromptInput value={input} onValueChange={setInput} onSubmit={handleSubmit}>
      <PromptInputTextarea
        placeholder="Ask anything about Nigerian law"
        className="text-foreground"
      />
      <PromptInputActions className="flex items-center justify-end gap-2 px-3 pb-3">
        <PromptInputAction tooltip="Send message">
          <Button
            type="button"
            size="icon"
            className="size-8 rounded-full bg-primary hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <ArrowUp className="size-5" />
          </Button>
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  );
}
