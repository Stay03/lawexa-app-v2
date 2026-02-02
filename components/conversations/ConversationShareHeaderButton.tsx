'use client';

import { useState, useEffect } from 'react';
import { Globe, Lock, Loader2, Share2, Check } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToggleConversationVisibility } from '@/lib/hooks/useConversationSharing';
import { useAuthStore } from '@/lib/stores/authStore';
import { chatApi } from '@/lib/api/chat';
import { toast } from 'sonner';

/**
 * Share button for conversation pages - to be used in the main layout header.
 * Fetches conversation ownership/visibility state based on current URL.
 * Only renders for conversation owners.
 */
function ConversationShareHeaderButton() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [isPrivate, setIsPrivate] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const toggleVisibility = useToggleConversationVisibility();

  // Extract conversation ID from pathname
  const conversationId = pathname.startsWith('/c/') ? pathname.split('/')[2] : null;

  // Fetch conversation metadata on mount or when pathname changes
  useEffect(() => {
    if (!conversationId || !user?.id) {
      setIsLoading(false);
      setIsOwner(false);
      return;
    }

    setIsLoading(true);
    chatApi
      .getConversation(conversationId)
      .then((response) => {
        if (response.success && response.data) {
          setIsPrivate(response.data.is_private);
          setIsOwner(response.data.user_id === user.id);
        } else {
          setIsOwner(false);
        }
      })
      .catch(() => {
        setIsOwner(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [conversationId, user?.id]);

  // Don't render if not on a conversation page, not the owner, or still loading
  if (!conversationId || isLoading || !isOwner) {
    return null;
  }

  const handleToggleVisibility = async () => {
    try {
      const result = await toggleVisibility.mutateAsync(conversationId);
      const newIsPrivate = result.data.is_private;
      setIsPrivate(newIsPrivate);
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
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2"
          disabled={toggleVisibility.isPending}
        >
          {toggleVisibility.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isPrivate ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span>Share</span>
        </Button>
      </DropdownMenuTrigger>
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

export { ConversationShareHeaderButton };
