import type { CaseIngestion, CaseIngestionExtracted } from '@/types/admin-case-ingestions';

/**
 * Comparing what our model read against what was saved.
 *
 * ── THE COMPARISON HAS THREE OUTCOMES, NOT TWO ────────────────────────────
 * A field can agree, disagree, or be impossible to compare, and the third one
 * is the whole reason this file exists. `result.extracted` is null on every
 * upload, on every plugin job and on every ticket written before it existed,
 * and `result.metadata`'s shape has never been pinned. Collapsing "we could
 * not compare" into "they agreed" is how a screen ends up quietly reporting
 * that nothing ever disagrees.
 *
 * So a chip is shown only for a field that was really compared and really
 * differs, and a card with nothing comparable says that instead of going
 * quiet.
 */

/** The seven fields the provider overwrites, and so the seven worth comparing. */
const SCALAR_FIELDS = [
  'title',
  'short_title',
  'judgment_date',
  'citation',
  'suit_no',
  'court_name',
] as const;

type ScalarField = (typeof SCALAR_FIELDS)[number];

export type ExtractedFieldKey = ScalarField | 'judge_names';

export interface ExtractedComparison {
  key: ExtractedFieldKey;
  label: string;
  /** What our model read. */
  model: string | null;
  /** What was saved, which on these fields is the provider's value. */
  saved: string | null;
  /** False when either side is missing, which is not a disagreement. */
  comparable: boolean;
  differs: boolean;
}

const LABELS: Record<ExtractedFieldKey, string> = {
  title: 'Title',
  short_title: 'Short title',
  judgment_date: 'Judgment date',
  citation: 'Citation',
  suit_no: 'Suit number',
  court_name: 'Court',
  judge_names: 'Judges',
};

export function extractedOf(ingestion: CaseIngestion | null): CaseIngestionExtracted | null {
  return ingestion?.result?.extracted ?? null;
}

/** `metadata` is untyped, so it is read as a bag and only by keys we can name. */
function savedBag(ingestion: CaseIngestion | null): Record<string, unknown> | null {
  const metadata = ingestion?.result?.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

/** Trimmed, whitespace-collapsed and case-folded: a casing difference in a
 *  printed name is not a disagreement about the case. */
function flat(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function asText(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

/** A date, compared as a day. "2023-01-27" and "2023-01-27T00:00:00Z" agree. */
function asDay(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? flat(value) : date.toISOString().slice(0, 10);
}

function namesOf(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const names = value.map(asText).filter((n): n is string => !!n);
  return names.length ? names : null;
}

/** Two lists of judges agree when they name the same people, in any order. */
function sameNames(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].map(flat).sort();
  const right = [...b].map(flat).sort();
  return left.every((name, i) => name === right[i]);
}

/**
 * One row per field the model answered, whether or not it could be compared.
 * Empty when the ticket kept no model answer at all.
 */
export function extractedComparisons(ingestion: CaseIngestion | null): ExtractedComparison[] {
  const extracted = extractedOf(ingestion);
  if (!extracted) return [];
  const saved = savedBag(ingestion);
  const rows: ExtractedComparison[] = [];

  for (const key of SCALAR_FIELDS) {
    const model = asText(extracted[key]);
    const savedValue = saved ? asText(saved[key]) : null;
    const comparable = model !== null && savedValue !== null;
    const differs =
      comparable &&
      (key === 'judgment_date'
        ? asDay(model) !== asDay(savedValue)
        : flat(model) !== flat(savedValue));
    rows.push({ key, label: LABELS[key], model, saved: savedValue, comparable, differs });
  }

  const modelJudges = namesOf(extracted.judge_names);
  const savedJudges = saved ? namesOf(saved.judge_names) : null;
  const judgesComparable = modelJudges !== null && savedJudges !== null;
  rows.push({
    key: 'judge_names',
    label: LABELS.judge_names,
    model: modelJudges ? modelJudges.join(', ') : null,
    saved: savedJudges ? savedJudges.join(', ') : null,
    comparable: judgesComparable,
    differs: judgesComparable && !sameNames(modelJudges, savedJudges),
  });

  return rows;
}

export interface ExtractedSummary {
  /** No model answer was kept on this ticket; nothing can be said. */
  absent: boolean;
  /** A model answer exists but no field had two sides to compare. */
  nothingComparable: boolean;
  disagreeing: ExtractedComparison[];
  /** The model's own count of the cover, or null when it read none. */
  partiesCount: number | null;
  counselCount: number | null;
}

export function extractedSummary(ingestion: CaseIngestion | null): ExtractedSummary {
  const extracted = extractedOf(ingestion);
  if (!extracted) {
    return {
      absent: true,
      nothingComparable: false,
      disagreeing: [],
      partiesCount: null,
      counselCount: null,
    };
  }

  const rows = extractedComparisons(ingestion);
  return {
    absent: false,
    nothingComparable: !rows.some((r) => r.comparable),
    disagreeing: rows.filter((r) => r.differs),
    partiesCount: Array.isArray(extracted.parties) ? extracted.parties.length : null,
    counselCount: Array.isArray(extracted.counsel) ? extracted.counsel.length : null,
  };
}

/******************************************************************************
              The model's cover against the rows that were saved
******************************************************************************/

export interface RowComparison {
  label: string;
  modelCount: number | null;
  savedCount: number | null;
  /** Both sides arrived, so the counts mean something. */
  comparable: boolean;
  countsDiffer: boolean;
  /** Names present on the model's side but not on the saved rows, and back. */
  onlyModel: string[];
  onlySaved: string[];
  /** The model's rows carried no readable name, so only counts were compared. */
  countsOnly: boolean;
}

/**
 * A name out of a row whose shape we do not control.
 *
 * `extracted.parties` and `extracted.counsel` are the model's own arrays and
 * their element shape has never been posted, so this reads the shapes a name
 * could plausibly take and gives up honestly rather than guessing.
 */
function rowName(row: unknown): string | null {
  if (typeof row === 'string') return row.trim() || null;
  if (!row || typeof row !== 'object') return null;
  const bag = row as Record<string, unknown>;
  return asText(bag.name) ?? asText(bag.line) ?? asText(bag.names) ?? null;
}

function rowNames(rows: unknown[] | null | undefined): { names: string[]; complete: boolean } {
  if (!Array.isArray(rows)) return { names: [], complete: false };
  const names = rows.map(rowName).filter((n): n is string => !!n);
  return { names, complete: names.length === rows.length && rows.length > 0 };
}

function compareRows(
  label: string,
  modelRows: unknown[] | null | undefined,
  savedRows: unknown[] | null | undefined
): RowComparison {
  // ABSENT and EMPTY are different facts on both sides: the show payload sends
  // [] for "none" and sends nothing at all on a listing, so a missing array is
  // "we were not told", never "there are none".
  const hasModel = Array.isArray(modelRows);
  const hasSaved = Array.isArray(savedRows);
  const model = rowNames(modelRows);
  const saved = rowNames(savedRows);
  const modelCount = hasModel ? modelRows!.length : null;
  const savedCount = hasSaved ? savedRows!.length : null;
  const comparable = hasModel && hasSaved;
  const byName = comparable && model.complete && saved.complete;

  const flatSet = (names: string[]) => new Set(names.map(flat));
  const modelSet = flatSet(model.names);
  const savedSet = flatSet(saved.names);

  return {
    label,
    modelCount,
    savedCount,
    comparable,
    countsDiffer: comparable && modelCount !== savedCount,
    onlyModel: byName ? model.names.filter((n) => !savedSet.has(flat(n))) : [],
    onlySaved: byName ? saved.names.filter((n) => !modelSet.has(flat(n))) : [],
    countsOnly: comparable && !byName,
  };
}

/**
 * The model's parties and counsel against the created case's rows.
 *
 * The case has to be fetched for this, which is why it is done once when a
 * reviewer opens the dialog and never from the list. Returns an empty list
 * when either side is missing, so a case fetched before the payload carried
 * these keys reports nothing rather than reporting a difference.
 */
export function rowComparisons(
  ingestion: CaseIngestion | null,
  /**
   * Only the two arrays are read, and taking them structurally keeps this off
   * both of the two CaseDetail types the app carries for the same endpoint
   * (`types/case.ts` for the reader, `types/admin-cases.ts` for admin).
   */
  caseDetail: { parties?: unknown[] | null; counsel?: unknown[] | null } | null | undefined
): RowComparison[] {
  const extracted = extractedOf(ingestion);
  if (!extracted || !caseDetail) return [];
  return [
    compareRows('Parties', extracted.parties, caseDetail.parties),
    compareRows('Counsel', extracted.counsel, caseDetail.counsel),
  ].filter((row) => row.comparable);
}
