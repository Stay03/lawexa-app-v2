'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { extractApiError } from '@/lib/utils/api-error';
import type { SpaceFile } from '@/types/collab';
import { FileViewers } from '@/v2/features/files/FileViewers';
import { filesQueries } from '@/v2/features/files/queries';
import type { ShownFiles } from '@/v2/features/files/use-file-viewer';
import { listViewable, pictureTarget } from '@/v2/features/files/viewable';
import { SpaceFileCard } from './SpaceFileCard';
import type { SpaceFileActions } from './SpaceFileMenu';
import { linkedFileFrame, linkedFileRefusal } from './linked-file';

/**
 * SpaceLinkedFile — the one file a link names (`&file=`), opened over the
 * pill the link asked for (Arthur, 3 November 2026: a Radar report's affected
 * file "opens folder instead of the file itself"). The parent keys it on the
 * file, so another link starts it afresh.
 *
 * IT OPENS WHERE A TAP ON THE FILE'S ROW WOULD (`linkedFileFrame`): a PDF in
 * the PDF reader, a picture, a video or a recording in the space's viewer,
 * any other file in the space's file card, as a sheet, since there is no row
 * for it to hang from. The file is read by its id (`GET /files/{id}`, the
 * download's own `view` rule, so any member of its space may read it), and
 * what is open is worked out from that read and one "closed" flag rather than
 * set when the read lands.
 *
 * A FILE THAT DOES NOT OPEN SAYS SO ONCE, as a toast, and the pill stays as
 * it is. Closing the file, or that note, takes `&file=` out of the address
 * (`onClose`), so a reload shows the pill alone.
 */
export function SpaceLinkedFile({
  fileId,
  actionsFor,
  onClose,
}: {
  fileId: number;
  /** What this reader may do to a file of the space (the feed's own rules). */
  actionsFor: (file: SpaceFile) => SpaceFileActions;
  onClose: () => void;
}) {
  const detail = useQuery(filesQueries.detail(fileId));
  const file: SpaceFile | null = detail.data?.data ?? null;
  const [closed, setClosed] = useState(false);
  const frame = file ? linkedFileFrame(file) : null;
  const open = file !== null && !closed;

  const failed = detail.isError;
  const failure = detail.error;
  useEffect(() => {
    if (!failed) return;
    toast.error(linkedFileRefusal(extractApiError(failure).status));
    onClose();
  }, [failed, failure, onClose]);

  const close = () => {
    setClosed(true);
    onClose();
  };

  // The viewer's one picture, video or recording: the set is this file alone.
  const pictures = useMemo(() => (file && frame === 'gallery' ? listViewable([file], 'File') : []), [file, frame]);
  const shown: ShownFiles = {
    picture: open && frame === 'gallery' ? pictureTarget(file.id) : null,
    // The set has one file, so the viewer only ever asks to close.
    setPicture: (target) => {
      if (target === null) close();
    },
    returnTo: null,
    pdf: {
      file:
        open && frame === 'pdf'
          ? { id: file.id, name: file.original_name, mimeType: file.mime_type || 'application/pdf', size: file.size }
          : null,
      close,
      returnTo: null,
    },
  };

  return (
    <>
      <FileViewers viewer={shown} pictures={pictures} place="space" />
      <SpaceFileCard
        file={frame === 'card' ? file : null}
        anchor={null}
        bottomClearance={16}
        open={open && frame === 'card'}
        onOpenChange={(next) => {
          if (!next) close();
        }}
        actions={file ? actionsFor(file) : {}}
        // A file the card offers no View or Play for never calls it.
        onView={() => {}}
      />
    </>
  );
}
