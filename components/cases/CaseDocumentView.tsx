'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { CaseDetail } from '@/types/case';

interface CaseDocumentViewProps {
  caseData: CaseDetail;
}

/**
 * Format body text - converts plain text with \r\n to proper HTML paragraphs
 * Also formats legal headings like "Held:" as bold
 */
function formatBodyText(text: string): string {
  // Split by double line breaks (paragraphs)
  const paragraphs = text
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Format each paragraph
  const formattedParagraphs = paragraphs.map((paragraph) => {
    // Check if paragraph is a legal heading (e.g., "Held:", "Facts:", "Issue:", "Decision:")
    const headingMatch = paragraph.match(/^(Held|Facts|Issue|Decision|Ratio|Obiter|Per\s+\w+):?\s*/i);

    if (headingMatch) {
      const heading = headingMatch[0].replace(/:?\s*$/, '');
      const rest = paragraph.slice(headingMatch[0].length);

      if (rest.length > 0) {
        // Heading with content on same line
        return `<p><strong>${heading}:</strong> ${rest}</p>`;
      } else {
        // Standalone heading
        return `<p><strong>${heading}:</strong></p>`;
      }
    }

    return `<p>${paragraph}</p>`;
  });

  return formattedParagraphs.join('\n');
}

/**
 * Document-style view of case data - renders like a legal document/MS Word
 * Used in Reader Mode for clean, printable reading experience
 */
function CaseDocumentView({ caseData }: CaseDocumentViewProps) {
  const {
    title,
    court,
    country,
    judgment_date,
    tags,
    principles,
    body,
    judges,
    topic,
    judicial_precedent,
  } = caseData;

  // Format date
  const formattedDate = judgment_date
    ? new Date(judgment_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Format body text with proper paragraphs and headings
  const formattedBody = body ? formatBodyText(body) : '';

  return (
    <article className="case-document">
      {/* Document Header */}
      <header className="document-header">
        <h1 className="document-title">{title}</h1>

        {/* Court & Date Line (no citation) */}
        <div className="document-meta">
          {court && <span className="court">{court.name}</span>}
          {country && (
            <>
              {court && <span className="separator">|</span>}
              <span className="country">{country.name}</span>
            </>
          )}
          {formattedDate && (
            <>
              {(court || country) && <span className="separator">|</span>}
              <span className="date">{formattedDate}</span>
            </>
          )}
        </div>

        {/* Tags - clickable links */}
        {tags && tags.length > 0 && (
          <div className="document-tags">
            {tags.map((tag) => (
              <Link key={tag} href={`/cases?tags=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 transition-colors">
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Judges */}
      {judges && judges.length > 0 && (
        <section className="document-section judges-section">
          <p className="judges-line">
            <strong>Before:</strong> {judges.map((j) => j.name).join(', ')}
          </p>
        </section>
      )}

      {/* Legal Principles */}
      {principles && (
        <section className="document-section">
          <h2 className="section-heading">Legal Principles</h2>
          <div className="section-content">
            <p>{principles}</p>
          </div>
        </section>
      )}

      {/* Case Summary / Body */}
      {formattedBody && (
        <section className="document-section">
          <h2 className="section-heading">Case Summary</h2>
          <div
            className="section-content body-content"
            dangerouslySetInnerHTML={{ __html: formattedBody }}
          />
        </section>
      )}

      {/* Additional Information */}
      {(topic || judicial_precedent) && (
        <section className="document-section additional-section">
          {topic && (
            <p className="info-line">
              <strong>Topic:</strong> {topic}
            </p>
          )}
          {judicial_precedent && (
            <p className="info-line">
              <strong>Judicial Precedent:</strong> {judicial_precedent}
            </p>
          )}
        </section>
      )}

      {/* Document Footer */}
      <footer className="document-footer">
        <div className="footer-line" />
      </footer>
    </article>
  );
}

export { CaseDocumentView };
export type { CaseDocumentViewProps };
