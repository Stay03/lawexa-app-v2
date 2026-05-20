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
import { BookmarkButton } from '@/components/common/BookmarkButton';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { AddToFolderButton } from '@/components/folders';
import { ExportDocxButton } from '@/components/notes/ExportDocxButton';
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
  searchParams: Promise<{ q?: string }>;
}

/**
 * Note detail view page with animated sections
 */
function NoteViewPage({ params, searchParams }: NoteViewPageProps) {
  const { slug } = use(params);
  const { q: searchQuery } = use(searchParams);
  const router = useRouter();
  const { user } = useAuthStore();
  const { data, isLoading, isError, refetch } = useNote(slug, searchQuery);

  // Loading state — match the editorial layout's gutter breakout so the
  // skeleton lands in exactly the same column as the loaded content.
  if (isLoading) {
    return (
      <div className="-mx-4 sm:mx-0">
        <NoteDetailSkeleton />
      </div>
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
      {/* Negative-margin breakout to let the editorial column claim the full
          mobile viewport width, neutralising the (main) layout's p-4 frame. */}
      <div className="-mx-4 sm:mx-0">
        <PageContainer variant="detail" className="px-5 pb-24 sm:px-6">
          {/* Editorial header */}
          <NoteDetailHeader
            note={note}
            showStatus={isOwner}
            animationDelay={ANIMATION_DELAYS.header}
          />

          {/* Action row — horizontally scrollable on mobile so nothing clips */}
          <div
            className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both -mx-5 overflow-x-auto duration-200 sm:mx-0 sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ animationDelay: `${ANIMATION_DELAYS.actions}ms` }}
          >
            <div className="flex w-max items-center gap-2 px-5 sm:w-auto sm:flex-wrap sm:px-0">
              <BookmarkButton
                type="note"
                id={note.id}
                isBookmarked={note.is_bookmarked}
                bookmarksCount={note.bookmarks_count}
                variant="full"
              />
              <FeedbackButton
                context={{
                  contentType: 'note',
                  contentId: note.id,
                  contentTitle: note.title,
                }}
                variant="full"
              />
              <AddToFolderButton itemType="note" itemId={note.id} />
              {hasFullContent && <ExportDocxButton slug={slug} />}
              <NoteActions
                note={note}
                canEdit={canEdit}
                animationDelay={0}
              />
            </div>
          </div>

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
              className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both border-y border-dashed border-foreground/15 px-2 py-10 text-center duration-300"
              style={{ animationDelay: `${ANIMATION_DELAYS.content}ms` }}
            >
              <p className="italic text-muted-foreground" style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}>
                Purchase this note to read the full text.
              </p>
            </div>
          )}

          {/* Author footer */}
          <NoteAuthorCard
            author={note.user}
            animationDelay={ANIMATION_DELAYS.author}
          />
        </PageContainer>
      </div>
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
