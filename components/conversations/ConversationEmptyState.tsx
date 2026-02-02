'use client';

import { MessageSquare, TrendingUp, Search } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

interface ConversationEmptyStateProps {
  type?: 'browse' | 'trending' | 'search';
  className?: string;
}

/**
 * Empty state component for conversation lists
 */
function ConversationEmptyState({ type = 'browse', className }: ConversationEmptyStateProps) {
  if (type === 'search') {
    return (
      <EmptyState
        icon={Search}
        title="No conversations found"
        description="Try adjusting your search or filters to find what you're looking for."
        className={className}
      />
    );
  }

  if (type === 'trending') {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No trending conversations yet"
        description="Conversations will appear here once they start gaining views and engagement."
        className={className}
      />
    );
  }

  return (
    <EmptyState
      icon={MessageSquare}
      title="No shared conversations"
      description="Be the first to share a conversation! Start a chat and make it public to share your knowledge."
      className={className}
    />
  );
}

export { ConversationEmptyState };
