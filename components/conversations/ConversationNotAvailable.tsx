'use client';

import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Shown when a conversation is not available (private, archived, or not found).
 */
function ConversationNotAvailable() {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] text-center px-4">
      <div className="mb-4 rounded-full bg-muted p-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">
        Conversation Not Available
      </h2>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        This conversation may be private, archived, or may not exist.
        Check the link or browse other shared conversations.
      </p>
      <Button asChild>
        <Link href="/shared">Browse Shared Conversations</Link>
      </Button>
    </div>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default ConversationNotAvailable;
export { ConversationNotAvailable };
