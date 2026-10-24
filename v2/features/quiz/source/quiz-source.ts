import type { QuizSource } from '@/types/channel-quiz';

/**
 * quiz-source — the line that says where a question or a scenario comes from
 * (Stay, 24 October 2026: Lawexa makes the quiz, its questions and their
 * source). A Library item links to its page in the app; a page on the web
 * links out as an outside source; a file has no page of its own, so it is
 * named without a link. The quote is a short excerpt of what the question
 * rests on.
 *
 * The server leaves out what the viewer may not see (a private note, a file,
 * a question's source before the attempt is finished): `null`, and no line.
 */

export interface QuizSourceView {
  /** "Case", "Statute", "Note", "File", or "Outside source". */
  label: string;
  title: string;
  /** The app address of a Library item, the outside address of a web page; `null` for none. */
  href: string | null;
  /** A web page, opened in a new tab. */
  external: boolean;
  quote: string | null;
}

const LABELS: Readonly<Record<QuizSource['kind'], string>> = {
  case: 'Case',
  statute: 'Statute',
  note: 'Note',
  file: 'File',
  web: 'Outside source',
};

/** Longest quote shown; a longer one ends in "…". */
export const QUOTE_MAX = 220;

export function quizSourceView(source: QuizSource | null | undefined): QuizSourceView | null {
  if (!source || !(source.kind in LABELS)) return null;
  const url = text(source.url);
  const web = source.kind === 'web';
  const outside = url !== null && /^https?:\/\//i.test(url);
  // Only an outside address for a web page, only an address in the app for a Library item.
  const href = web ? (outside ? url : null) : url !== null && url.startsWith('/') && !url.startsWith('//') ? url : null;
  const title = text(source.title) ?? (web && href ? hostOf(href) : null);
  if (!title) return null;
  return { label: LABELS[source.kind], title, href, external: web && href !== null, quote: excerpt(source.quote) };
}

function excerpt(value: unknown): string | null {
  const quote = text(value);
  if (!quote) return null;
  const flat = quote.replace(/\s+/g, ' ');
  return flat.length > QUOTE_MAX ? `${flat.slice(0, QUOTE_MAX - 1).trimEnd()}…` : flat;
}

function hostOf(href: string): string | null {
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
