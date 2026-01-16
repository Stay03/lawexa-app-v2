'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ViewFullReportButton } from './ViewFullReportButton';
import type { CaseDetail, RelatedCase } from '@/types/case';

interface CaseDocumentViewProps {
  caseData: CaseDetail;
  slug: string;
  similarCases?: RelatedCase[] | null;
  citedCases?: RelatedCase[] | null;
  citedBy?: RelatedCase[] | null;
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
 * Related case item for document view - minimal styling
 */
function DocumentRelatedCaseItem({ caseItem }: { caseItem: RelatedCase }) {
  const { title, slug, citation, judgment_date, court } = caseItem;

  const formattedDate = judgment_date
    ? new Date(judgment_date).toLocaleDateString('en-GB', {
        year: 'numeric',
      })
    : null;

  return (
    <li className="related-case-item">
      <Link href={`/cases/${slug}`} className="related-case-link">
        <span className="related-case-title">{title}</span>
        {(citation || court || formattedDate) && (
          <span className="related-case-meta">
            {citation && <span>{citation}</span>}
            {court && !citation && <span>{court.name}</span>}
            {formattedDate && <span>({formattedDate})</span>}
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * Document-style view of case data - renders like a legal document/MS Word
 * Used in Reader Mode for clean, printable reading experience
 */
function CaseDocumentView({
  caseData,
  slug,
  similarCases,
  citedCases,
  citedBy,
}: CaseDocumentViewProps) {
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
    has_full_report,
  } = caseData;

  const hasRelatedCases =
    (similarCases && similarCases.length > 0) ||
    (citedCases && citedCases.length > 0) ||
    (citedBy && citedBy.length > 0);

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

        {/* View Full Report Button */}
        {has_full_report && (
          <div className="mt-4 flex justify-center">
            <ViewFullReportButton slug={slug} variant="outline" hasFullReport={has_full_report} />
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

      {/* Topic - at the top */}
      {topic && (
        <section className="document-section">
          <p className="info-line">
            <strong>Topic:</strong> {topic}
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
      {judicial_precedent && (
        <section className="document-section additional-section">
          <p className="info-line">
            <strong>Judicial Precedent:</strong> {judicial_precedent}
          </p>
        </section>
      )}

      {/* Related Cases */}
      {hasRelatedCases && (
        <section className="document-section related-cases-section">
          <h2 className="section-heading">Related Cases</h2>
          <div className="related-cases-content">
            {/* Similar Cases */}
            {similarCases && similarCases.length > 0 && (
              <div className="related-cases-group">
                <ul className="related-cases-list">
                  {similarCases.map((c) => (
                    <DocumentRelatedCaseItem key={c.id} caseItem={c} />
                  ))}
                </ul>
              </div>
            )}

            {/* Cases Cited */}
            {citedCases && citedCases.length > 0 && (
              <div className="related-cases-group">
                <h3 className="related-cases-subheading">Cases Cited</h3>
                <ul className="related-cases-list">
                  {citedCases.map((c) => (
                    <DocumentRelatedCaseItem key={c.id} caseItem={c} />
                  ))}
                </ul>
              </div>
            )}

            {/* Cited By */}
            {citedBy && citedBy.length > 0 && (
              <div className="related-cases-group">
                <h3 className="related-cases-subheading">Cited By</h3>
                <ul className="related-cases-list">
                  {citedBy.map((c) => (
                    <DocumentRelatedCaseItem key={c.id} caseItem={c} />
                  ))}
                </ul>
              </div>
            )}
          </div>
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
