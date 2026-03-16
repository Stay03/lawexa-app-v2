import type { StatuteDetail } from '@/types/statute';

interface StatuteDocumentHeaderProps {
  statute: StatuteDetail;
}

/**
 * Legal publication-style centered header for statute document view.
 */
function StatuteDocumentHeader({ statute }: StatuteDocumentHeaderProps) {
  const formattedDate = statute.commencement_date
    ? new Date(statute.commencement_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="document-header">
      <h1 className="document-title">{statute.title}</h1>

      {statute.short_title && statute.short_title !== statute.title && (
        <p className="document-subtitle">{statute.short_title}</p>
      )}

      <div className="document-meta">
        {formattedDate && (
          <p>
            <strong>Commenced on {formattedDate}</strong>
          </p>
        )}
        {statute.country && (
          <p>{statute.country.name} &middot; {statute.year}</p>
        )}
        {!statute.country && <p>{statute.year}</p>}
      </div>
    </div>
  );
}

export { StatuteDocumentHeader };
