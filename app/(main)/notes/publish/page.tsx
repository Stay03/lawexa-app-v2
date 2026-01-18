'use client';

import { useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { NotePublishPage, type PublishData } from '@/components/notes/NotePublishPage';
import { useNote, useUpdateNote } from '@/lib/hooks/useNotes';
import { useAuthStore } from '@/lib/stores/authStore';
import { canEditNote, getNoteUrl } from '@/lib/utils/note-utils';
import { extractApiError } from '@/lib/utils/api-error';
import { transformNoteFormData } from '@/lib/utils/note-validation';

function PublishNewNoteContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');
  const router = useRouter();
  const { user } = useAuthStore();
  const { data, isLoading, isError, refetch } = useNote(slug || '');
  const updateNote = useUpdateNote();

  // Handle publish/draft submission
  const handleSubmit = useCallback(
    async (publishData: PublishData) => {
      if (!data?.data) return;

      try {
        const transformedData = transformNoteFormData({
          title: data.data.title,
          content: data.data.content || '',
          tags: publishData.tags,
          is_private: publishData.is_private,
          price_ngn: publishData.price_ngn,
          price_usd: publishData.price_usd,
          status: publishData.status,
        });

        const result = await updateNote.mutateAsync({
          id: data.data.id,
          data: transformedData,
        });

        const statusMessage = publishData.status === 'published' ? 'published' : 'saved as draft';
        toast.success('Note created', {
          description: `Your note has been ${statusMessage}.`,
        });

        router.push(getNoteUrl(result.data));
      } catch (error) {
        const apiError = extractApiError(error);
        toast.error('Failed to save note', {
          description: apiError.message,
        });
      }
    },
    [data?.data, updateNote, router]
  );

  // Handle cancel - go back to create page (auto-save will restore)
  const handleCancel = useCallback(() => {
    router.push('/notes/create');
  }, [router]);

  // No slug provided
  if (!slug) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <EmptyState
            icon={FileText}
            title="No note to publish"
            description="Please create a note first before publishing."
            action={{ label: 'Create Note', onClick: () => router.push('/notes/create') }}
          />
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between border-b pb-4 mb-8">
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-7 w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-6">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <ErrorState
            title="Failed to load note"
            description="We couldn't load this note. Please try again."
            retry={() => refetch()}
          />
        </div>
      </div>
    );
  }

  // Not found state
  if (!data?.data) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <EmptyState
            icon={FileText}
            title="Note not found"
            description="The note you're trying to publish doesn't exist or has been removed."
            action={{ label: 'Create Note', onClick: () => router.push('/notes/create') }}
          />
        </div>
      </div>
    );
  }

  const note = data.data;

  // Check authorization
  if (!canEditNote(note, user)) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <EmptyState
            icon={FileText}
            title="Not authorized"
            description="You don't have permission to publish this note."
            action={{ label: 'Browse Notes', onClick: () => router.push('/notes') }}
          />
        </div>
      </div>
    );
  }

  return (
    <NotePublishPage
      title={note.title}
      content={note.content || ''}
      initialData={{
        tags: note.tags?.join(', '),
        is_private: note.is_private,
        price_ngn: note.price_ngn,
        price_usd: note.price_usd,
      }}
      onPublish={(data) => handleSubmit(data)}
      onSaveDraft={(data) => handleSubmit(data)}
      onCancel={handleCancel}
      isSubmitting={updateNote.isPending}
    />
  );
}

function PublishNewNotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <div className="max-w-4xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between border-b pb-4 mb-8">
              <div className="flex items-center gap-4">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-7 w-40" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-6">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="space-y-6">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            </div>
          </div>
        </div>
      }
    >
      <PublishNewNoteContent />
    </Suspense>
  );
}

export default PublishNewNotePage;
