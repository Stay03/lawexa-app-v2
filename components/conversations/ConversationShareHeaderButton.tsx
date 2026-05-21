'use client';

import { useState, useEffect } from 'react';
import { Globe, Lock, Loader2, Check, Copy } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToggleConversationVisibility } from '@/lib/hooks/useConversationSharing';
import { useAuthStore } from '@/lib/stores/authStore';
import { useConfidentialModeStore } from '@/lib/stores/confidentialModeStore';
import { chatApi } from '@/lib/api/chat';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Share button for conversation pages - to be used in the main layout header.
 * Opens a dialog with Private/Public options and shareable link.
 * Only renders for conversation owners.
 */
function ConversationShareHeaderButton() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [isPrivate, setIsPrivate] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleVisibility = useToggleConversationVisibility();

  // Extract conversation ID from pathname
  const conversationId = pathname.startsWith('/c/') ? pathname.split('/')[2] : null;
  // Confidential conversations cannot be published. Short-circuit the API call
  // (it 404s) and never render the share affordance.
  const isConfidential = useConfidentialModeStore((s) => s.isConfidential(conversationId));

  // Generate shareable link
  const shareableLink = conversationId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/c/${conversationId}`
    : '';

  // Fetch conversation metadata on mount or when pathname changes
  useEffect(() => {
    if (!conversationId || !user?.id || isConfidential) {
      setIsLoading(false);
      setIsOwner(false);
      return;
    }

    setIsLoading(true);
    chatApi
      .getConversation(conversationId)
      .then((response) => {
        if (response.success && response.data) {
          if (response.data.is_confidential) {
            setIsOwner(false);
            return;
          }
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
  }, [conversationId, user?.id, isConfidential]);

  // Don't render if not on a conversation page, confidential, not the owner, or still loading
  if (!conversationId || isConfidential || isLoading || !isOwner) {
    return null;
  }

  const handleSetPrivate = async () => {
    if (isPrivate) return; // Already private
    try {
      const result = await toggleVisibility.mutateAsync(conversationId);
      setIsPrivate(result.data.is_private);
      toast.success('Conversation is now private');
    } catch (error) {
      toast.error('Failed to update visibility');
    }
  };

  const handleSetPublic = async () => {
    if (!isPrivate) return; // Already public
    try {
      const result = await toggleVisibility.mutateAsync(conversationId);
      setIsPrivate(result.data.is_private);
      toast.success('Conversation is now public');
    } catch (error) {
      toast.error('Failed to update visibility');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2"
        >
          {isPrivate ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span>Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat shared</DialogTitle>
          <DialogDescription>
            This conversation may include personal information.
            Take a moment to check the content before sharing the link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {/* Private option */}
          <button
            onClick={handleSetPrivate}
            disabled={toggleVisibility.isPending}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors',
              isPrivate
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Private</p>
              <p className="text-sm text-muted-foreground">Only you have access</p>
            </div>
            {isPrivate && (
              <Check className="h-5 w-5 text-primary" />
            )}
            {toggleVisibility.isPending && !isPrivate && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </button>

          {/* Public option */}
          <button
            onClick={handleSetPublic}
            disabled={toggleVisibility.isPending}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors',
              !isPrivate
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/50'
            )}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Public access</p>
              <p className="text-sm text-muted-foreground">Anyone with the link can view</p>
            </div>
            {!isPrivate && (
              <Check className="h-5 w-5 text-primary" />
            )}
            {toggleVisibility.isPending && isPrivate && (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Shareable link - only shown when public */}
        {!isPrivate && (
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={shareableLink}
              className="flex-1 text-sm"
            />
            <Button
              onClick={handleCopyLink}
              variant="default"
              className="shrink-0"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                'Copy link'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { ConversationShareHeaderButton };
