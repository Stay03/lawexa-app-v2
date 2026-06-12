import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

import { ReportSources } from './ReportSources';
import type { RadarScanDetail } from '@/types/radar';

const SOURCES_HEADING = '\n## Sources';

/**
 * Split the markdown report at its trailing "## Sources" section — the
 * structured sources list replaces it with typed, linkable rows. When the
 * heading is absent the whole report renders followed by the structured list.
 */
function splitReport(report: string): string {
  const index = report.lastIndexOf(SOURCES_HEADING);
  return index === -1 ? report : report.slice(0, index);
}

interface ReportViewProps {
  scan: RadarScanDetail;
}

function ReportView({ scan }: ReportViewProps) {
  const narrative = scan.report ? splitReport(scan.report) : null;

  return (
    <div className="space-y-6">
      {narrative && (
        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_a]:text-primary [&_code]:bg-muted [&_pre]:overflow-x-auto [&_pre]:bg-muted">
          <ReactMarkdown remarkPlugins={[remarkBreaks, remarkGfm]}>
            {narrative}
          </ReactMarkdown>
        </div>
      )}

      {scan.sources.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Sources</h2>
          <ReportSources sources={scan.sources} />
        </section>
      )}
    </div>
  );
}

export { ReportView };
