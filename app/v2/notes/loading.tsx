import { DestinationFallback } from '@/v2/runtime/destination-fallback';
import { NoteFallback } from '@/v2/features/notes/reader/NoteScreen';
import { NotesFallback } from '@/v2/features/notes/library/NotesScreen';

/**
 * The `notes` SEGMENT boundary — it paints the shape of the DESTINATION.
 *
 * Notes has a third kind of child, the authoring routes (`create`,
 * `[slug]/edit`). They are deliberately NOT named as index paths: an editor is
 * a document-shaped column, so the reader silhouette is a near miss rather than
 * a wrong one, and each of them carries its own boundary underneath this.
 * `destination-fallback.tsx` carries the full account.
 */
export default function NotesSegmentLoading() {
  return (
    <DestinationFallback
      indexPaths={['/notes', '/v2/notes']}
      index={<NotesFallback />}
      document={<NoteFallback />}
    />
  );
}
