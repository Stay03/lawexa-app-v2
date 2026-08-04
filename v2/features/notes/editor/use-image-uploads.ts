'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

import { useDeleteNoteFile, useUploadNoteImage } from '../mutations';

/**
 * use-image-uploads — picking, checking, uploading, inserting, and (only where
 * it is provably safe) cleaning up an image.
 *
 * ── THE 5MB CHECK HAPPENS BEFORE THE UPLOAD, NOT AFTER ──────────────────────
 * The backend refuses files over 5MB. Sending one anyway means a phone user
 * spends thirty seconds of mobile data to be told no, so the size and type are
 * checked at the door and the refusal names the real number. That is the whole
 * of the "honest message" rule: say what is wrong, in the units the reader
 * chose the file in.
 *
 * ── THE CLEANUP RULE, AND ITS EXACT LIMIT ───────────────────────────────────
 * Uploads live in `POST /files`, independently of notes: deleting a NOTE does
 * not delete its images (documented backend behaviour), and a URL that has ever
 * been saved may also have been copied into another note. So the only file this
 * hook will ever delete is one that
 *
 *     • was uploaded in THIS editing session, and
 *     • is no longer anywhere in the document, and
 *     • was never part of a body the server accepted.
 *
 * That third condition is what `commit()` maintains: after every successful
 * save, any tracked upload whose URL appears in the saved body is FORGOTTEN —
 * permanently out of reach of the cleanup. What remains is exactly the "picked
 * the wrong picture and deleted it again" case, where we know for certain no
 * saved note references the file. Everything else is left alone, on purpose: an
 * orphaned file is a cost; a deleted image inside somebody's note is damage.
 *
 * ── AND IT WAITS UNTIL THE SESSION ENDS ─────────────────────────────────────
 * Deleting the moment an image leaves the document was wrong for one reason:
 * UNDO. Removing an image and pressing ⌘Z is one gesture, but between the two
 * the URL is absent from the body — so an eager cleanup destroyed the file and
 * the undo restored an `<img>` pointing at a dead link. There is no way to ask
 * ProseMirror "is this URL still reachable in the undo stack", and guessing is
 * how you break someone's note.
 *
 * So nothing is deleted while the editor is open. `reconcile()` only tracks
 * what is currently absent; the deletes go out ONCE, at unmount, for uploads
 * that are still absent then and were never saved. By that point the undo stack
 * is gone too, so "no longer in the document" is finally a settled fact rather
 * than a moment in an edit.
 *
 * The delete itself is best-effort and silent (`useDeleteNoteFile`) — the reader
 * did not ask for it and must not be interrupted by its failure.
 */

/** The backend's per-file ceiling. Also what the refusal message quotes. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** What the picker offers and what the backend accepts. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const IMAGE_INPUT_ACCEPT = ACCEPTED_TYPES.join(',');

/** Human size for a refusal message: "6.4MB", not "6710886 bytes". */
function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/** Pure: the reason this file cannot be uploaded, or `null`. */
export function rejectImage(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'That file type is not supported. Use a JPG, PNG, GIF or WebP image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `That image is ${formatMegabytes(file.size)}. The limit is 5MB — try a smaller one.`;
  }
  return null;
}

export interface NoteImageUploads {
  /** An upload is on the wire. */
  busy: boolean;
  /** A refusal or a failure, shown inline in the paper. */
  error: string | null;
  dismissError: () => void;
  /**
   * Check, upload and insert one picked file. The `<input type="file">` itself
   * belongs to the SCREEN, not to this hook: handing a ref object back out of a
   * hook makes the component read it during render, which the React Compiler
   * lint rejects (`react-hooks/refs`). The split is also the honest one — the
   * hook owns upload POLICY, the screen owns its own DOM.
   */
  upload: (file: File) => void;
  /** After a successful save: everything in `savedContent` is now permanent. */
  commit: (savedContent: string) => void;
  /**
   * On every document change: note which uncommitted uploads are currently
   * absent from the body. Deletes nothing — see the header on why cleanup waits
   * for unmount, when undo can no longer bring an image back.
   */
  reconcile: (content: string) => void;
}

export function useNoteImageUploads(editor: Editor | null): NoteImageUploads {
  const uploadImage = useUploadNoteImage();
  const { mutate: deleteFile } = useDeleteNoteFile();
  const [error, setError] = useState<string | null>(null);

  /**
   * URL → what we know about an upload from this session that no save has yet
   * accepted. `present` is refreshed by `reconcile()` on every document change
   * and is only ACTED on at unmount.
   */
  const uncommittedRef = useRef(new Map<string, { id: number; present: boolean }>());

  const dismissError = useCallback(() => setError(null), []);

  const upload = useCallback(
    (file: File) => {
      if (!editor) return;

      const refusal = rejectImage(file);
      if (refusal !== null) {
        setError(refusal);
        return;
      }

      setError(null);
      uploadImage.mutate(file, {
        onSuccess: (response) => {
          const { id, url } = response.data;
          // Insert FIRST, then track, so the entry is never born marked absent.
          editor.chain().focus().setImage({ src: url }).run();
          uncommittedRef.current.set(url, { id, present: true });
        },
        onError: () => {
          setError('That image could not be uploaded. Please try again.');
        },
      });
    },
    [editor, uploadImage],
  );

  const commit = useCallback((savedContent: string) => {
    const pending = uncommittedRef.current;
    if (pending.size === 0) return;
    for (const url of [...pending.keys()]) {
      if (savedContent.includes(url)) pending.delete(url);
    }
  }, []);

  const reconcile = useCallback((content: string) => {
    const pending = uncommittedRef.current;
    if (pending.size === 0) return;
    // Record only. An image can leave the document and come straight back with
    // one ⌘Z, so absence during an edit proves nothing.
    //
    // Re-`set` rather than assigning to `entry.present`: the React Compiler
    // treats a value handed to `useRef` as frozen, so writing a property THROUGH
    // the ref is an error while replacing the map entry is not. Same cost, and
    // the immutable spelling is the one the rule is asking for.
    for (const [url, entry] of [...pending.entries()]) {
      pending.set(url, { id: entry.id, present: content.includes(url) });
    }
  }, []);

  // The one cleanup pass, at the end of the session. Anything still uncommitted
  // AND still absent was uploaded here, never saved, and can no longer be
  // restored by undo — the only state in which deleting it is provably safe.
  useEffect(() => {
    const pending = uncommittedRef.current;
    return () => {
      for (const entry of pending.values()) {
        if (!entry.present) deleteFile(entry.id);
      }
      pending.clear();
    };
  }, [deleteFile]);

  return {
    busy: uploadImage.isPending,
    error,
    dismissError,
    upload,
    commit,
    reconcile,
  };
}
