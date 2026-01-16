'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { CaseDetail, FullReport } from '@/types/case';

/******************************************************************************
                               Types
******************************************************************************/

interface IFullReportDocumentViewProps {
  caseData: CaseDetail;
  fullReport: FullReport;
}

/******************************************************************************
                               Functions
******************************************************************************/

/**
 * Format full report text - converts plain text with line breaks to proper HTML
 * Detects and formats legal headings like "Held:", "Facts:", etc.
 */
function formatFullReportText(text: string): string {
  // Split by double line breaks (paragraphs)
  const paragraphs = text
    .split(/\r?\n\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Format each paragraph
  const formattedParagraphs = paragraphs.map((paragraph) => {
    // Check if paragraph is a legal heading
    const headingMatch = paragraph.match(
      /^(Held|Facts|Issue|Decision|Ratio|Obiter|Per\s+\w+|Judgment|Appeal|Background|Analysis|Conclusion|Dissent|Concurrence):?\s*/i
    );

    if (headingMatch) {
      const heading = headingMatch[0].replace(/:?\s*$/, '');
      const rest = paragraph.slice(headingMatch[0].length);

      if (rest.length > 0) {
        return `<p><strong>${heading}:</strong> ${rest}</p>`;
      } else {
        return `<p><strong>${heading}:</strong></p>`;
      }
    }

    return `<p>${paragraph}</p>`;
  });

  return formattedParagraphs.join('\n');
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Document-style view of full case report - renders the complete legal document
 * Used in Full Report page for comprehensive reading experience
 */
function FullReportDocumentView({ caseData, fullReport }: IFullReportDocumentViewProps) {
  const {
    title,
    court,
    country,
    judgment_date,
    citation,
    tags,
    judges,
  } = caseData;

  // Format date
  const formattedDate = judgment_date
    ? new Date(judgment_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Format full report text with proper paragraphs and headings
  const formattedFullText = formatFullReportText(fullReport.full_text);

  return (
    <article className="case-document">
      {/* Document Header */}
      <header className="document-header">
        <h1 className="document-title">{title}</h1>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Full Case Report
        </p>

        {/* Court & Date Line */}
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

        {/* Citation */}
        {citation && (
          <div className="document-citation mt-2">
            <span className="font-semibold">{citation}</span>
          </div>
        )}

        {/* Tags */}
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

      {/* Full Report Content */}
      <section className="document-section">
        <h2 className="section-heading">Full Judgment</h2>
        <div
          className="section-content body-content"
          dangerouslySetInnerHTML={{ __html: formattedFullText }}
        />
      </section>

      {/* Document Footer */}
      <footer className="document-footer">
        <div className="footer-line" />
        <p className="text-xs text-center text-muted-foreground mt-4">
          Last updated: {new Date(fullReport.updated_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </footer>
    </article>
  );
}

/******************************************************************************
                               Export
******************************************************************************/

export { FullReportDocumentView };
export type { IFullReportDocumentViewProps };
