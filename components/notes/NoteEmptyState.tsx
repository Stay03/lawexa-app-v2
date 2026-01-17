'use client';

import { useRouter } from 'next/navigation';
import { FileText, Plus, Search } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

interface NoteEmptyStateProps {
  type?: 'browse' | 'my-notes' | 'search';
  className?: string;
}

/**
 * Empty state component for notes list
 */
function NoteEmptyState({ type = 'browse', className }: NoteEmptyStateProps) {
  const router = useRouter();

  if (type === 'search') {
    return (
      <EmptyState
        icon={Search}
        title="No notes found"
        description="Try adjusting your search or filters to find what you're looking for."
        className={className}
      />
    );
  }

  if (type === 'my-notes') {
    return (
      <EmptyState
        icon={FileText}
        title="No notes yet"
        description="Create your first note to start building your collection."
        action={{
          label: 'Create Note',
          onClick: () => router.push('/notes/create'),
        }}
        className={className}
      />
    );
  }

  return (
    <EmptyState
      icon={FileText}
      title="No notes available"
      description="Be the first to share your knowledge by creating a note."
      action={{
        label: 'Create Note',
        onClick: () => router.push('/notes/create'),
      }}
      className={className}
    />
  );
}

export { NoteEmptyState };
