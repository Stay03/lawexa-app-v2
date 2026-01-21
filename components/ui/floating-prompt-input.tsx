'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Loader2 } from 'lucide-react';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { chatApi } from '@/lib/api/chat';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface FloatingPromptInputProps {
  className?: string;
}

export function FloatingPromptInput({ className }: FloatingPromptInputProps) {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const { state } = useSidebar();
  const isMobile = useIsMobile();

  // Calculate left offset based on sidebar state
  const sidebarWidth = isMobile ? '0px' : state === 'expanded' ? '16rem' : '3rem';

  const handleSubmit = async () => {
    if (!input.trim() || isSubmitting) return;

    const message = input.trim();
    setIsSubmitting(true);

    try {
      const response = await chatApi.start({
        message,
        stream: true,
      });

      if (response.success) {
        const conversationId = response.data.conversation_id;
        const executionId = response.data.execution_id;
        router.push(`/c/${conversationId}?msg=${encodeURIComponent(message)}&exec=${executionId}`);
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 z-50 right-0 px-4 transition-[left] duration-200 ease-linear',
        className
      )}
      style={{ left: sidebarWidth }}
    >
      <div className={cn(
        "mx-auto transition-all duration-300 ease-out hover:scale-105",
        isFocused ? "max-w-sm sm:max-w-lg" : "max-w-xs sm:max-w-md"
      )}>
        <PromptInput
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          disabled={isSubmitting}
          maxHeight={36}
        >
          <div className="flex items-center gap-2 px-1">
            <PromptInputTextarea
              placeholder="Ask a question..."
              className="text-foreground min-h-[36px] py-2"
              disableAutosize
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            <PromptInputAction tooltip="Send message">
              <Button
                size="icon"
                className="bg-primary hover:bg-primary/90 h-7 w-7 rounded-full shrink-0"
                onClick={handleSubmit}
                disabled={!input.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </Button>
            </PromptInputAction>
          </div>
        </PromptInput>
      </div>
    </div>
  );
}
