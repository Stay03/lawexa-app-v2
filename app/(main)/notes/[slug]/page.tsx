'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import {
  NoteDetailSkeleton,
  NoteDetailHeader,
  NoteContent,
  NotePriceCard,
  NoteActions,
  NoteAuthorCard,
} from '@/components/notes';
import { PageContainer } from '@/components/layout';
import { FloatingPromptInput } from '@/components/ui/floating-prompt-input';
import { useNote } from '@/lib/hooks/useNotes';
import { useAuthStore } from '@/lib/stores/authStore';
import { canEditNote, isNoteOwner } from '@/lib/utils/note-utils';

/******************************************************************************
                               Constants
******************************************************************************/

const ANIMATION_DELAYS = {
  header: 0,
  actions: 100,
  priceCard: 150,
  content: 200,
  author: 350,
} as const;

/******************************************************************************
                               Components
******************************************************************************/

interface NoteViewPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Note detail view page with animated sections
 */
function NoteViewPage({ params }: NoteViewPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const { data, isLoading, isError, refetch } = useNote(slug);

  // Loading state
  if (isLoading) {
    return (
      <PageContainer variant="detail">
        <NoteDetailSkeleton />
      </PageContainer>
    );
  }

  // Error state
  if (isError) {
    return (
      <PageContainer variant="detail">
        <ErrorState
          title="Failed to load note"
          description="We couldn't load this note. Please try again."
          retry={() => refetch()}
        />
      </PageContainer>
    );
  }

  // Not found state
  if (!data?.data) {
    return (
      <PageContainer variant="detail">
        <EmptyState
          icon={FileText}
          title="Note not found"
          description="The note you're looking for doesn't exist or has been removed."
          action={{ label: 'Browse Notes', onClick: () => router.push('/notes') }}
        />
      </PageContainer>
    );
  }

  const note = data.data;
  const isOwner = isNoteOwner(note, user);
  const canEdit = canEditNote(note, user);

  // Check if content is accessible (owner/admin or free note)
  const hasFullContent = note.content !== null;

  return (
    <>
      <PageContainer variant="detail" className="pb-24">
        {/* Hero Header */}
      <NoteDetailHeader
        note={note}
        showStatus={isOwner}
        animationDelay={ANIMATION_DELAYS.header}
      />

      {/* Actions */}
      <NoteActions
        note={note}
        canEdit={canEdit}
        animationDelay={ANIMATION_DELAYS.actions}
      />

      {/* Price Card (for paid notes when user doesn't have access) */}
      {!hasFullContent && note.is_paid && (
        <NotePriceCard
          note={note}
          onPurchase={() => {
            // TODO: Implement purchase flow
            console.log('Purchase note:', note.id);
          }}
          animationDelay={ANIMATION_DELAYS.priceCard}
        />
      )}

      {/* Content */}
      {hasFullContent ? (
        <NoteContent
          content={note.content}
          animationDelay={ANIMATION_DELAYS.content}
        />
      ) : (
        <div
          className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 p-8 text-center duration-300"
          style={{ animationDelay: `${ANIMATION_DELAYS.content}ms` }}
        >
          <p className="text-muted-foreground">
            Purchase this note to view the full content.
          </p>
        </div>
      )}

        {/* Author Card */}
        <NoteAuthorCard
          author={note.user}
          animationDelay={ANIMATION_DELAYS.author}
        />
      </PageContainer>
      <FloatingPromptInput
        contextSlug={slug}
        contextType="note"
        contextTitle={note.title}
      />
    </>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default NoteViewPage;
