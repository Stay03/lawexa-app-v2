/**
 * Case type definitions for Phase 5 API
 */

// Court type embedded in Case
export interface Court {
  name: string;
  slug: string;
  abbreviation: string;
}

// Country type embedded in Case
export interface Country {
  id: number;
  name: string;
  slug: string;
  code: string;
  abbreviation: string;
}

// The judge's role on a case's coram (pivot field, July 2026 contract).
// `null` = unknown / legacy row.
export type CoramRole = 'lead' | 'concurring' | 'dissenting';

// Judge type for case detail
export interface Judge {
  id: number;
  name: string;
  slug: string;
  // Coram role pivot — optional because pre-July payloads (and cached
  // responses) do not carry it.
  role?: CoramRole | null;
  created_at: string;
  updated_at: string;
}

// Full report type (from include_full_report=true)
export interface FullReport {
  id: number;
  case_id: number;
  full_text: string;
  created_at: string;
  updated_at: string;
}

// Related case type (for similar_cases, and the base shape of cited_by)
export interface RelatedCase {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  excerpt: string;
  citation: string | null;
  judgment_date: string | null;
  court: Court | null;
  country: Country | null;
}

// How a citing case treated the authority it cited.
// See docs/api/case-structures-and-enrichment.md (backend repo).
export type CaseTreatment =
  | 'followed'
  | 'applied'
  | 'approved'
  | 'considered'
  | 'referred_to'
  | 'distinguished'
  | 'doubted'
  | 'not_followed'
  | 'overruled';

// Disposition of a case. `null` = the document's disposition didn't map cleanly.
export type CaseOutcome =
  | 'appeal_allowed'
  | 'appeal_dismissed'
  | 'appeal_allowed_in_part'
  | 'retrial_ordered'
  | 'convicted'
  | 'acquitted'
  | 'judgment_for_plaintiff'
  | 'judgment_for_defendant'
  | 'dismissed'
  | 'struck_out'
  | 'application_granted'
  | 'application_refused';

// An outgoing citation edge (cited_cases). `id` is the EDGE id, NOT a case id.
// When `cited_case_id` is null the citation points at a case not in our DB —
// render `raw` as the name and do not link. Linked rows carry title/slug/citation.
export interface CitedCaseEdge {
  id: number;
  cited_case_id: number | null;
  raw: string | null;
  title: string | null;
  display_title: string | null;
  slug: string | null;
  citation: string | null;
  treatment: CaseTreatment | null;
  /** The reporter key of the cited report, `part_1_page`, or null when the
   *  printed citation gives no part. Null is "unreadable", never "none". */
  nwlr_key?: string | null;
}

// A reverse citation (cited_by): the old related-case shape plus a treatment label.
export interface CitedByCase extends RelatedCase {
  treatment: CaseTreatment | null;
}

// A verbatim principle extracted from the judgment (report_principles[]).
// End users (below Researcher) receive ONLY `reviewed: true` rows — the server
// filters the rest — so `reviewed: false` is visible to Researcher+ accounts
// and should be badged as unreviewed, never hidden client-side.
export interface ReportPrinciple {
  id: number;
  principle: string;
  // Present only when the principle is attributed; `role` is the judge's coram
  // role on THIS case.
  judge?: { id: number; name: string; slug: string; role: CoramRole | null } | null;
  type: 'ratio' | 'obiter' | null;
  tag: string | null;
  law_type: string[] | null;
  reviewed: boolean;
  order: number;

  /**
   * The judgment's own words behind this principle — the passage the extractor
   * cut it from, with a little of the sentence around it.
   *
   * ── WHY A READER GETS THIS AND NOT THE JUDGMENT ───────────────────────────
   * A principle is OUR sentence about what the court held. This is the COURT'S
   * sentence. Showing it is the difference between being told what a case says
   * and reading it, and for a reader who is not paying it is the only judgment
   * text on the page.
   *
   * The server truncates it for readers without a subscription and caps how
   * many principles carry one, so the page can never add up to the judgment.
   * The owner agreed the number knowingly: about 3,000 characters per case,
   * roughly 500 words, near enough one percent of a typical judgment.
   *
   * `null` when this principle has no measured passage — most often because it
   * is shorter than the six-word run the matcher works in.
   */
  verbatim_window?: string | null;

  /**
   * The exact span the principle was matched against, raw from the judgment.
   *
   * Shorter than the window: this is the match itself, with nothing either
   * side. It is what a highlight paints.
   *
   * ── THE RULE THAT KEEPS IT SAFE, AND IT IS NOT OBVIOUS ────────────────────
   * Its words are by construction the longest run of THIS PRINCIPLE found in
   * the judgment, so every word in it is already in the principle above it.
   * That is the whole reason it can be shown to a reader who is not paying.
   * It follows that the quote MAY ONLY EVER BE RENDERED ALONGSIDE THE FULL
   * PRINCIPLE IT WAS CUT FOR. Show it on its own — in a teaser, a summary
   * list, or beside a truncated principle — and it stops being bounded by
   * anything and becomes raw judgment text.
   */
  verbatim_quote?: string | null;

  /**
   * The same span under the shared normalisation, for locating it in rendered
   * text without the browser re-deriving the string and drifting.
   *
   * It KEEPS punctuation on purpose. A word-boundary test that demands a space
   * on each side will reject every passage wrapped in quotation marks or ending
   * on a full stop — measured at 20 of 149 before it was fixed. Use
   * `isWordAligned` in lib/utils/quote-locator.ts, which asks the right
   * question: a cut is inside a word only when the characters on both sides of
   * it are word characters.
   */
  verbatim_quote_key?: string | null;
}

// One statute this judgment cited (statutes_cited[]). When `statute_id` is set
// a `statute` object is included — render as a link; when null, render `raw`
// as plain text (unresolved; a future healing job links these).
/**
 * One party as the report's cover prints it.
 *
 * `name` keeps the cover's capitals; casing happens at render through
 * `casePartyName` so our column and the provider's stay byte-identical.
 */
export interface CaseParty {
  position: number;
  name: string;
  /** "appellant" and "respondent" today; a cover may print another word. */
  role: string;
  /** Sent by the provider. Its meaning is not settled, so nothing renders it. */
  group: number | null;
  appeal_number: string | null;
}

/**
 * Which SIDE the cover numbered, a sibling of `parties` and not a field on a
 * row. A cover that numbers the respondents ("1st - 10th Respondents") and
 * leaves the appellant bare is the usual shape, so the numbering is only
 * printed for the side that carried it.
 */
export interface PartiesNumbered {
  appellant: boolean;
  respondent: boolean;
}

export interface CaseCounselPerson {
  name: string;
  /** "lead" for the named counsel, "with" for those the line puts with them. */
  rank: 'lead' | 'with' | null;
  /** The splitter could not read the line cleanly; the printed line is still
   *  exact, so the reader is shown the line and told the split is uncertain. */
  unsure: boolean;
}

/** One printed counsel line and the people read out of it. */
export interface CaseCounselLine {
  /** The line exactly as the report prints it, side included. */
  line: string;
  /** The line with the side removed. */
  names: string | null;
  side: string | null;
  role: string | null;
  /** Which numbered parties the line appears for, e.g. [1..10]. */
  positions: number[];
  people: CaseCounselPerson[];
}

export type CaseArgumentStatus =
  | 'accepted'
  | 'rejected'
  | 'partly_accepted'
  | 'not_decided'
  | null;

/**
 * A case this submission stands on.
 *
 * `cited_case_id` and `slug` are null until the reporter key resolves to a
 * case we hold, so anything rendering this must print the key or the name
 * rather than build a link to nowhere.
 */
export interface CaseArgumentAuthority {
  cited_case_id: number | null;
  nwlr_key: string | null;
  slug: string | null;
  display_title: string | null;
}

/** The judge whose words answer a submission, with their role on the coram. */
export interface CaseArgumentJudge {
  id: number;
  name: string;
  slug: string | null;
  role: string | null;
}

/**
 * One submission and the court's answer to it.
 *
 * ── WHAT IS NULL HERE IS NORMAL ───────────────────────────────────────────
 * `side` is null whenever the judgment wrote "learned counsel submitted"
 * without naming a side, which is common and is not a fault. `verbatim_quote`
 * and `verbatim_window` are null on EVERY row today, because the scorer that
 * fills them does principles only.
 *
 * ── TWO ABSENCES THAT MEAN DIFFERENT THINGS ───────────────────────────────
 * `judge` is ABSENT, not null, when no judge is attached to this row; that
 * says nothing about the case's panel. And a reader below Researcher receives
 * only reviewed rows, filtered at load time with no marker that anything was
 * withheld, so a short list is not evidence that a case argued little.
 */
export interface CaseArgument {
  id: number;
  side: string | null;
  counsel_name: string | null;
  argument: string;
  status?: CaseArgumentStatus;
  court_response: string | null;
  judge?: CaseArgumentJudge | null;
  verbatim_quote: string | null;
  verbatim_window: string | null;
  authorities?: CaseArgumentAuthority[] | null;
  /** False on every row until somebody reviews it. Absent counts as false. */
  reviewed?: boolean;
  /**
   * When a REVIEWER threw the row out, which is a different fact from
   * `status`: that one is the COURT's answer to the submission, and a court
   * rejecting an argument is a real outcome a reader should see. The load-time
   * filter drops rejected rows for ordinary readers, and the key is served to
   * a Researcher or above so the page can drop them too.
   */
  rejected_at?: string | null;
}

export interface StatuteCitedEdge {
  id: number;
  statute_id: number | null;
  raw: string | null;
  provision: string | null;
  statute?: { id: number; title: string; slug: string } | null;
  /**
   * Which of the three printed lists the row came from.
   *
   * The provider prints statutes, rules of court and books as separate blocks
   * and they all land in this table. Only a `statute` may ever render as a
   * link to a statute page: a rule of court has no page here, and a textbook
   * linked as legislation is a wrong answer wearing a citation's clothes.
   *
   * Absent on every row written before the column existed; treat an absent
   * kind as `statute`, which is what those rows are.
   */
  kind?: 'statute' | 'rule' | 'book' | null;
}

// One step of the case's procedural chain (court_history[], ordered). When
// `related_case_id` is set, title/slug/court/decided_date/outcome describe the
// linked case; otherwise `label` is the whole entry.
export interface CourtHistoryStep {
  id: number;
  related_case_id: number | null;
  label: string | null;
  order: number;
  title: string | null;
  slug: string | null;
  court: string | null;
  decided_date: string | null;
  outcome: CaseOutcome | null;

  /* ── From the report's printed History block ─────────────────────────────
     Everything below arrives from the provider's front matter. A step written
     before these existed carries `label` alone, so the renderer must still
     read a step that has nothing but a label. What comes back empty is empty
     IN THE PRINT: most Supreme Court reports name the Court of Appeal's
     division and number but not its panel. */

  /** The court's full name where the print gives one, e.g. "High Court of the
   *  Federal Capital Territory, Abuja". `court` is the section heading. */
  court_name?: string | null;
  /** e.g. "Court of Appeal, Abuja." */
  division?: string | null;
  /** Appeal or suit numbers as printed; a step can carry more than one. */
  numbers?: string[] | null;
  /** The date lines as printed, beside the parsed `decided_date`. */
  date_raw?: string[] | null;
  /** The panel that sat, as one printed string. */
  coram?: string | null;
  /** Where `coram` was read from, e.g. "cover"; null when the print named it
   *  in the history block itself. */
  coram_source?: string | null;
  /** The whole section as printed, every line, so nothing is hidden by a
   *  field we failed to parse. */
  lines?: string[] | null;
}

// Meta information for SEO
export interface CaseMeta {
  title: string;
  description: string;
  canonical: string;
}

// Case list item (from GET /api/cases)
export interface Case {
  id: number;
  title: string;
  display_title: string;
  slug: string;
  excerpt: string;
  topic: string | null;
  tags: string[] | null;
  principles: string | null;
  level: string | null;
  course: string | null;
  court: Court | null;
  country: Country | null;
  judgment_date: string | null;
  citation: string | null;
  views_count: number;
  is_bookmarked: boolean;
  bookmarks_count: number;
  meta: CaseMeta;
  /**
   * True when a named provider supplied the judgment behind this case rather
   * than it being typed in or imported blind.
   *
   * THE FLAG IS PUBLIC AND THE PROVIDER IS NOT. The owner set that line himself
   * on 3 September 2026: a reader may know a judgment is verified, but which
   * service verified it stays inside admin, where it lives on the duplicates
   * row as `sources` (see `CaseSourceDocument`). So there is no provider name
   * anywhere in this file, and adding one here would leak it to every reader.
   *
   * Optional because the corpus is mixed: cached responses and the lean bot
   * payload predate the field, and `undefined` must read as "not stated" rather
   * than "not verified".
   */
  is_verified?: boolean;
}

// View limit error from 429 response
export interface CaseViewLimitError {
  limit_type: string;
  plan_limit: number;
  hard_limit: number;
  used: number;
  remaining: number;
  resets_at: string;
}

// Full case detail (from GET /api/cases/{slug})
//
// July 2026 contract notes (docs/api/case-structures-and-enrichment.md,
// backend repo): the show endpoint ALWAYS loads the structured relations
// (report_principles / statutes_cited / court_history) — only full_report and
// the citation sets stay behind include params. All structured fields are
// typed optional because the corpus is mixed (bot UAs get a lean payload, and
// cached pre-July responses lack them).
export interface CaseDetail extends Case {
  body: string | null;
  judges: Judge[];
  // Falls back to `title` server-side when unset.
  short_title?: string;
  suit_no?: string | null;
  outcome?: CaseOutcome | null;
  // Sub-national origin, e.g. "Kano", "Greater Accra".
  origin_state?: string | null;
  report_principles?: ReportPrinciple[];
  statutes_cited?: StatuteCitedEdge[];
  court_history?: CourtHistoryStep[];
  /**
   * The day the reporter issued the report, kept apart from `judgment_date`.
   * Optional because it exists only on cases imported or refreshed after the
   * provider began sending it (5 September 2026).
   */
  report_published_date?: string | null;
  nwlr_key?: string | null;

  /* ── FOUR LISTS WHOSE ABSENCE MEANS SOMETHING ─────────────────────────────
     `parties`, `counsel`, `cited_cases` and `cited_by` are ALWAYS PRESENT on
     /cases/{slug}, where `[]` means the case genuinely has none, and ABSENT on
     a listing row, where the question was never asked (a twenty-row listing
     would otherwise fire eighty queries). They sit on CaseDetail rather than
     Case for exactly that reason.

     So `[]` and absent are two different facts and must never be flattened
     into one. Read them with `?.length`, never `?? []` followed by a length
     test, which turns "nobody asked" into "the case has none" — the shape of
     the bug that hid the citation sections from every reader for months.

     They stay optional here until the show payload carries them everywhere. */
  parties?: CaseParty[];
  parties_numbered?: PartiesNumbered | null;
  counsel?: CaseCounselLine[];
  /** Same presence rule as the four lists above. */
  arguments?: CaseArgument[];
  has_full_report?: boolean;
  full_report?: FullReport | null;
  similar_cases?: RelatedCase[] | null;
  cited_cases?: CitedCaseEdge[] | null;
  cited_by?: CitedByCase[] | null;
  cited_by_count?: number;
  creator: {
    id: number;
    name: string;
    email: string;
    role: string;
    is_creator: boolean;
    is_verified: boolean;
    auth_provider: string;
    avatar_url: string | null;
    created_at: string;
  };
  created_at: string;
  updated_at: string;
  limit_exceeded?: boolean;
  limit_message?: string;
}

// Pagination metadata from API
export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
}

// Pagination links from API
export interface PaginationLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

// Paginated case list response
export interface CaseListResponse {
  success: boolean;
  message: string;
  data: Case[];
  pagination: PaginationMeta;
  links: PaginationLinks;
}

// Single case response
export interface CaseDetailResponse {
  success: boolean;
  message: string;
  data: CaseDetail | null;
}

// Query params for case list
export interface CaseListParams {
  page?: number;
  per_page?: number;
  search?: string;
  court_id?: number;
  country_id?: number;
  year?: number;
  tags?: string; // Filter by tags (comma-separated or single tag)
}
