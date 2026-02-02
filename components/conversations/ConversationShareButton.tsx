'use client';

import { useState } from 'react';
import { Globe, Lock, Loader2, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToggleConversationVisibility } from '@/lib/hooks/useConversationSharing';
import { toast } from 'sonner';

interface ConversationShareButtonProps {
  conversationId: string;
  isPrivate: boolean;
  onVisibilityChange?: (isPrivate: boolean) => void;
  className?: string;
}

/**
 * Button for managing conversation visibility (public/private)
 * Shows dropdown with toggle option and copy link for public conversations
 */
function ConversationShareButton({
  conversationId,
  isPrivate,
  onVisibilityChange,
  className,
}: ConversationShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const toggleVisibility = useToggleConversationVisibility();

  const handleToggleVisibility = async () => {
    try {
      const result = await toggleVisibility.mutateAsync(conversationId);
      const newIsPrivate = result.data.is_private;
      onVisibilityChange?.(newIsPrivate);
      toast.success(newIsPrivate ? 'Conversation is now private' : 'Conversation is now public');
    } catch (error) {
      toast.error('Failed to update visibility');
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/c/${conversationId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={className}
                disabled={toggleVisibility.isPending}
              >
                {toggleVisibility.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPrivate ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
                <span className="sr-only">Share settings</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isPrivate ? 'Private' : 'Public'} - Click to manage</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleToggleVisibility} className="gap-2">
          {isPrivate ? (
            <>
              <Globe className="h-4 w-4" />
              Make Public
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Make Private
            </>
          )}
        </DropdownMenuItem>
        {!isPrivate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  Copy Link
                </>
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ConversationShareButton };
