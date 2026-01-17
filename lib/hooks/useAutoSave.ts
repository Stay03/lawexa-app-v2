'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi } from '@/lib/api/notes';
import { noteKeys } from './useNotes';
import type { CreateNoteData, UpdateNoteData, Note } from '@/types/note';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions {
  /** Existing note data (for edit mode) */
  existingNote?: Partial<Note>;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Enable/disable auto-save */
  enabled?: boolean;
}

interface UseAutoSaveReturn {
  /** Current save status */
  saveStatus: SaveStatus;
  /** Timestamp of last successful save */
  lastSavedAt: Date | null;
  /** Human-readable save status text */
  lastSavedText: string;
  /** The note ID (after first save) */
  noteId: number | null;
  /** The note slug (after first save) */
  noteSlug: string | null;
  /** Manually trigger a save */
  triggerSave: (data: { title: string; content: string }) => void;
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
}

/**
 * Format relative time for save status display
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 5) {
    return 'Saved just now';
  } else if (diffSeconds < 60) {
    return `Saved ${diffSeconds} seconds ago`;
  } else if (diffMinutes === 1) {
    return 'Saved 1 minute ago';
  } else if (diffMinutes < 60) {
    return `Saved ${diffMinutes} minutes ago`;
  } else if (diffHours === 1) {
    return 'Saved 1 hour ago';
  } else {
    return `Saved ${diffHours} hours ago`;
  }
}

/**
 * Hook for auto-saving note content with debouncing
 */
export function useAutoSave({
  existingNote,
  debounceMs = 2000,
  enabled = true,
}: UseAutoSaveOptions = {}): UseAutoSaveReturn {
  const queryClient = useQueryClient();

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    existingNote?.updated_at ? new Date(existingNote.updated_at) : null
  );
  const [lastSavedText, setLastSavedText] = useState<string>(
    existingNote?.updated_at ? formatRelativeTime(new Date(existingNote.updated_at)) : ''
  );
  const [noteId, setNoteId] = useState<number | null>(existingNote?.id ?? null);
  const [noteSlug, setNoteSlug] = useState<string | null>(existingNote?.slug ?? null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<{ title: string; content: string }>({
    title: existingNote?.title ?? '',
    content: existingNote?.content ?? '',
  });

  // Create note mutation (for new notes)
  const createMutation = useMutation({
    mutationFn: (data: CreateNoteData) => notesApi.create(data),
    onSuccess: (response) => {
      const note = response.data;
      setNoteId(note.id);
      setNoteSlug(note.slug);
      setLastSavedAt(new Date());
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      // Update cache
      queryClient.invalidateQueries({ queryKey: noteKeys.myNotes() });
    },
    onError: () => {
      setSaveStatus('error');
    },
  });

  // Update note mutation (for existing notes)
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateNoteData }) =>
      notesApi.update(id, data),
    onSuccess: (response) => {
      const note = response.data;
      setNoteSlug(note.slug);
      setLastSavedAt(new Date());
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      // Update cache
      if (note.slug) {
        queryClient.setQueryData(noteKeys.detail(note.slug), response);
      }
      queryClient.invalidateQueries({ queryKey: noteKeys.myNotes() });
    },
    onError: () => {
      setSaveStatus('error');
    },
  });

  // Update relative time display periodically
  useEffect(() => {
    if (!lastSavedAt) return;

    const updateText = () => {
      setLastSavedText(formatRelativeTime(lastSavedAt));
    };

    // Update immediately
    updateText();

    // Update every 30 seconds
    const interval = setInterval(updateText, 30000);

    return () => clearInterval(interval);
  }, [lastSavedAt]);

  // Trigger save function
  const triggerSave = useCallback(
    (data: { title: string; content: string }) => {
      if (!enabled) return;

      // Skip if content hasn't changed
      const hasChanged =
        data.title !== lastSavedContentRef.current.title ||
        data.content !== lastSavedContentRef.current.content;

      if (!hasChanged) {
        setHasUnsavedChanges(false);
        return;
      }

      // Mark as having unsaved changes
      setHasUnsavedChanges(true);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        // Don't save if title is empty
        if (!data.title.trim()) {
          return;
        }

        setSaveStatus('saving');

        // Update the reference to current content
        lastSavedContentRef.current = { ...data };

        if (noteId) {
          // Update existing note
          updateMutation.mutate({
            id: noteId,
            data: {
              title: data.title,
              content: data.content,
              status: 'draft', // Keep as draft during auto-save
            },
          });
        } else {
          // Create new note
          createMutation.mutate({
            title: data.title,
            content: data.content,
            status: 'draft',
          });
        }
      }, debounceMs);
    },
    [enabled, noteId, debounceMs, createMutation, updateMutation]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    saveStatus,
    lastSavedAt,
    lastSavedText,
    noteId,
    noteSlug,
    triggerSave,
    hasUnsavedChanges,
  };
}
