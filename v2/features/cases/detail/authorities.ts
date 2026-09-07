import type {
  CaseTreatment,
  CitedCaseEdge,
  CoramRole,
  Judge,
  StatuteCitedEdge,
} from '@/types/case';
import { firstCitation, formatCaseName } from '../case-name';

/**
 * authorities.ts — the shaping layer between the API's citation edges and the
 * page's authority lists. Everything here is a pure function over the payload.
 *
 * WHY THIS FILE EXISTS. The July enrichment writes one edge per SENTENCE of the
 * judgment, not one per authority, and the raw strings arrive exactly as the
 * judge's clerk typed them. Measured on a real enriched case (Mbamalu, CA/L/863):
 *
 *   `statutes_cited`  27 rows for ~9 statutes — "Companies and Allied Matters
 *                     Act (CAMA)" appears EIGHT times, once per section cited,
 *                     and the same Act also appears as "…(CAMA), 2004" and
 *                     "…(CAMA), 2020" (which are genuinely different Acts).
 *   `cited_cases`     63 rows, every one an unresolved raw string with the
 *                     citation fused into the name ("MACFOY V. UAC (1962) A.C.
 *                     158"), including exact-duplicate cases cited through
 *                     parallel reports ("MACFOY VS. UAC (1962) AC 150").
 *
 * Rendering that verbatim is a data dump, not a page. The functions here turn
 * it into what a law report's front matter would print:
 *
 *   - statutes GROUP to one row per Act with its provisions collected
 *     ("ss 593, 594, 598, 600–602" as a joined list), keeping year-variants
 *     apart because CAMA 2004 and CAMA 2020 are different statutes;
 *   - case citations SPLIT into the party names and the report reference at
 *     the first year token, and every edge keeps its OWN row: see
 *     `citedCaseRows` for why they used to merge and why they must not.
 *
 * UNLINKED ROWS BECOME SEARCHES (owner, July 30): an authority we do not hold
 * links to the library with its name as the query — `/cases?search=Macfoy v.
 * UAC` — so every row on the page goes SOMEWHERE. Both list pages read
 * `?search=` from the URL, so landing there runs the search with the box
 * filled.
 */

/* ── Case-citation splitting ─────────────────────────────────────────────── */

/** The first year token — "(1962)", "[2014]" or bare "1994" — marks where the
 *  party names end and the report reference begins. */
const YEAR_TOKEN = /[([]?\b(?:1[89]\d{2}|20\d{2})\b/;

/** Split a raw fused citation into the case name and the report reference.
 *  When no year is found the whole string is the name (some raws are bare
 *  names: "NASCO MANAGEMENT SERVICES LTD. V. A.N. AMAKU TRANSPORT LTD"). */
export function splitRawCitation(raw: string): { name: string; ref: string | null } {
  const match = YEAR_TOKEN.exec(raw);
  if (!match || match.index === 0) return { name: raw.trim(), ref: null };
  const name = raw.slice(0, match.index).replace(/[\s,;–—-]+$/, '').trim();
  const ref = raw.slice(match.index).trim();
  if (!name) return { name: raw.trim(), ref: null };
  return { name, ref: ref || null };
}

export interface CitedCaseRow {
  key: string;
  /** Reader-facing case name (formatCaseName applied). */
  name: string;
  /** The source string, for the title attribute. */
  sourceTitle: string;
  /** The report reference. An array because the row shape predates this
   *  change and the renderer joins it; today it holds one entry or none. */
  refs: string[];
  /** Set when the case is in our library. */
  href: string | null;
  /** Set when it is not — a library search for the name. */
  searchHref: string | null;
  treatment: CaseTreatment | null;
}

/**
 * One row per citation edge, in the order the payload sends them.
 *
 * ── THIS MERGED ROWS THAT SHARED PARTY NAMES AND THAT WAS WRONG ───────────
 * The old key was the case name alone and never consulted the report
 * reference, so two different judgments between the same parties became one
 * row. Measured on case 11979, 7 September 2026: 50 edges drew 46 rows, and
 * one of the four collapses joined
 *
 *   Buhari v. Yabo (2018) 9 NWLR (Pt. 1624) 197
 *   Buhari v. Yabo (2006) 17 NWLR (Pt. 1007) 162
 *
 * Different parts, twelve years apart, two different reports, drawn as one row
 * with nothing on screen saying a second existed. A part implies a year and
 * parts run in sequence, so a disagreeing part is the signature of a different
 * case, not of a duplicate.
 *
 * The database was refused this exact rule the same morning, after a merge on
 * party names alone went wrong on 4 September and a person had to undo it. The
 * page was quietly doing what the database is not allowed to do.
 *
 * So a duplicate in the data now shows as a duplicate on the page. That is the
 * honest state, and it is the one the team chose deliberately: the repair folds
 * two cited rows only where they share a part-and-page key and their years do
 * not contradict, and anything it refuses stays visible here.
 */
/**
 * ONE ruler, used on BOTH halves of the merge key.
 *
 * Letters and digits only, folded to lower case. Measuring the name one way
 * and the reference another produced a count that looked reasonable and was
 * wrong by three groups: "2 H.LC.722" and "2 H.L.C. 722" paired under one
 * normalisation and not under the other. If you cannot say in one sentence
 * what the ruler is, there are two of them.
 */
function flatten(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Treatment strength, for the one that survives a join — the specific
 *  verdicts outrank the catch-all "referred to". */
const TREATMENT_RANK: Record<CaseTreatment, number> = {
  overruled: 0,
  not_followed: 1,
  doubted: 2,
  distinguished: 3,
  approved: 4,
  followed: 5,
  applied: 6,
  considered: 7,
  referred_to: 8,
};

function strongerTreatment(
  a: CaseTreatment | null,
  b: CaseTreatment | null,
): CaseTreatment | null {
  if (!a) return b;
  if (!b) return a;
  return (TREATMENT_RANK[a] ?? 9) <= (TREATMENT_RANK[b] ?? 9) ? a : b;
}

/**
 * One row per authority: edges join only when they name the same parties AND
 * the same report at the same page.
 *
 * ── WHY NOT THE NAME ALONE, WHICH IS WHAT THIS USED TO DO ─────────────────
 * Because two judgments between the same parties are ordinary here. Keying on
 * the name drew "Buhari v. Yabo (2018) 9 NWLR (Pt. 1624) 197" and "(2006) 17
 * NWLR (Pt. 1007) 162" as ONE row, hiding a second authority with nothing on
 * screen to say so. The database was refused that same rule after a merge on
 * party names went wrong on 4 September.
 *
 * ── WHY JOIN AT ALL, WHEN NOTHING JOINED FOR MOST OF TODAY ────────────────
 * Because a refresh stores the report's print beside our own, and on a case
 * old enough to cite English reports there is no NWLR key for the database
 * fold to work on, so nothing repairs it. Bello holds 96 rows for about 71
 * authorities, including "(1944) 2 K.B. 160", "2 KB. 160" and "2 KB 160" —
 * one report, three rows, punctuation apart.
 *
 * So the reference decides it. Same parties and the same reference, flattened
 * to letters and digits, is one authority. Anything that disagrees about a
 * volume, a part or a page stays two rows:
 *
 *   Baker v. Bolton (1808) 1 Camp. 498  and  (1808) 1 Camp. 493 stay apart.
 *   One is a typo and choosing which would be us guessing.
 *
 * A row whose text carries no year has no reference to compare, so its whole
 * flattened string is the key — that joins "Read v. Brown 22 Q.B.D. 128" to
 * "22 QBD 128" and still never joins two different texts.
 *
 * Measured over live payloads: Bello 96 rows to 77, nineteen removed in
 * eighteen groups, none of which joins rows whose printed references differ.
 * Garkuwa does not move at all: 50 rows before and after, Buhari still twice.
 */
export function citedCaseRows(edges: readonly CitedCaseEdge[]): CitedCaseRow[] {
  const order: string[] = [];
  const byKey = new Map<string, CitedCaseRow>();

  for (const edge of edges) {
    const linked = edge.cited_case_id !== null && !!edge.slug;
    let name: string;
    let ref: string | null;
    let source: string;

    if (linked) {
      source = edge.display_title || edge.title || edge.raw || '';
      name = formatCaseName(source);
      ref = firstCitation(edge.citation);
    } else {
      source = edge.raw || edge.citation || '';
      if (!source) continue;
      const split = splitRawCitation(source);
      name = formatCaseName(split.name);
      ref = split.ref;
    }

    const key = `${flatten(name)}||${flatten(ref ?? '')}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        // The first edge's id: rows sharing a name no longer share a key, and
        // a key built from the name alone would collide in the reconciler.
        key: `edge-${edge.id}`,
        name,
        sourceTitle: source,
        refs: ref ? [ref] : [],
        href: linked ? `/cases/${edge.slug}` : null,
        searchHref: linked ? null : caseSearchHref(name),
        treatment: edge.treatment,
      });
      order.push(key);
      continue;
    }

    // A join. The references are the same report by construction, so only the
    // link and the treatment can be better than what is already there.
    existing.treatment = strongerTreatment(existing.treatment, edge.treatment);
    if (linked && !existing.href) {
      existing.href = `/cases/${edge.slug}`;
      existing.searchHref = null;
    }
  }

  return order.map((key) => byKey.get(key)!);
}

function caseSearchHref(name: string): string {
  return `/cases?search=${encodeURIComponent(name)}`;
}

/* ── Statute grouping ────────────────────────────────────────────────────── */

export interface StatuteRow {
  key: string;
  /** The Act's name, e.g. "Companies and Allied Matters Act (CAMA)". */
  name: string;
  /** Joined provisions — "s 598" or "ss 593, 594, 598" — or null. */
  provisions: string | null;
  href: string | null;
  searchHref: string | null;
}

/** Grouping key: punctuation-insensitive but YEAR-KEEPING, because "CAMA,
 *  2004" and "CAMA, 2020" are different Acts and must not merge. */
function statuteKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

/** One edge's provision, split to its individual sections: the clerk writes
 *  both "s 598" and "ss 2(1), 24" — the compound form must break apart or the
 *  merged list shows "2(1), 2(1), 24, 24" next to its single-section twins. */
function bareProvisions(provision: string): string[] {
  return provision
    .replace(/^s{1,2}\.?\s*/i, '')
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Natural provision sort: by leading section number, then shortest first so
 *  "109" precedes "109(b)". */
function compareProvisions(a: string, b: string): number {
  const na = Number.parseInt(a, 10);
  const nb = Number.parseInt(b, 10);
  const ka = Number.isNaN(na) ? Number.MAX_SAFE_INTEGER : na;
  const kb = Number.isNaN(nb) ? Number.MAX_SAFE_INTEGER : nb;
  if (ka !== kb) return ka - kb;
  return a.length - b.length || a.localeCompare(b);
}

/**
 * Parentheticals that LOCATE a statute rather than NAME it.
 *
 * A bracket in a statute's title does one of two jobs and they pull opposite
 * ways:
 *
 *   "Evidence Act (Cap E14)"           a shelf mark. Dropping it is right, and
 *                                      joining that row to "Evidence Act" is
 *                                      what we want.
 *   "Court of Appeal (Amendment) Act"  part of the NAME. Dropping it makes an
 *                                      Act and the Act that amends it one
 *                                      statute, which no reading of the law
 *                                      allows.
 *
 * Measured 7 September 2026 on rossek-v-acb-ltd: the principal Court of Appeal
 * Act was GONE from the page and only "Court of Appeal (Amendment) Act, 1982"
 * was drawn, so a reader was told the case relied on an amending Act and not on
 * the Act it amends. It also swallowed "Customary Courts Law" into "Customary
 * Courts (Amendment) Law, 1959".
 *
 * Only shelf marks drop and anything unrecognised is KEPT, because the two
 * failures are not equal: keeping too much shows one Act as two rows, which a
 * reader can see and judge, and dropping too much deletes a statute from the
 * page with no sign it was there. Add a shape when one appears; never widen
 * this into a similarity test.
 */
const SHELF_MARK =
  /^(?:caps?\b|lfn\b|laws?\s+of\b|vol\.?\b|volume\b|ed\.?\b|edition\b|as\s+amended\b)/i;

/** Drop the shelf-mark brackets and keep every other bracket. */
function withoutShelfMarks(name: string): string {
  return name.replace(/\(([^)]*)\)/g, (whole: string, inner: string) =>
    SHELF_MARK.test(inner.trim()) ? ' ' : whole,
  );
}

/** The library search for a statute drops the shelf mark and the year tail —
 *  "Evidence Act, 2011" → "Evidence Act" — because the search matches titles
 *  and the library title may carry either form. A NAMING bracket stays, so a
 *  search for an amending Act does not fetch the Act it amends. */
export function statuteSearchTerm(name: string): string {
  const stripped = withoutShelfMarks(name)
    .replace(/,?\s*\b(?:19|20)\d{2}\b.*$/, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;]+$/, '')
    .trim();
  return stripped || name;
}

interface StatuteGroup {
  key: string;
  name: string;
  href: string | null;
  bare: string[];
}

/**
 * Group the statute edges into one row per Act with provisions collected.
 *
 * TWO PASSES. The first groups by the full normalized name, years kept. The
 * second merges name-variants of the SAME Act — "Evidence Act" + "Evidence
 * Act, 2011", or the Constitution cited three slightly different ways — but
 * ONLY when the variants' years do not conflict: CAMA 2004 and CAMA 2020 are
 * different statutes and stay apart (and the bare "CAMA" rows stay with them,
 * unattributable). The merged row keeps the most complete name — the longest
 * variant that carries the year.
 */
export function groupStatutes(edges: readonly StatuteCitedEdge[]): StatuteRow[] {
  const byKey = new Map<string, StatuteGroup>();

  for (const edge of edges) {
    const name = edge.statute?.title || edge.raw;
    if (!name) continue;
    const key = statuteKey(name) || `statute-${edge.id}`;

    let row = byKey.get(key);
    if (!row) {
      row = { key, name, href: null, bare: [] };
      byKey.set(key, row);
    }
    if (edge.statute?.slug) {
      row.href = `/statutes/${edge.statute.slug}`;
      row.name = edge.statute.title;
    }
    if (edge.provision) {
      for (const bare of bareProvisions(edge.provision)) {
        if (!row.bare.some((p) => p.toUpperCase() === bare.toUpperCase())) {
          row.bare.push(bare);
        }
      }
    }
  }

  // Second pass: merge year-compatible variants of one Act.
  const byBase = new Map<string, StatuteGroup[]>();
  for (const group of byKey.values()) {
    const base = statuteKey(statuteSearchTerm(group.name)) || group.key;
    const list = byBase.get(base);
    if (list) list.push(group);
    else byBase.set(base, [group]);
  }

  const merged: StatuteGroup[] = [];
  for (const variants of byBase.values()) {
    const years = new Set(
      variants
        .map((v) => /\b((?:19|20)\d{2})\b/.exec(v.name)?.[1])
        .filter((year): year is string => !!year),
    );
    if (variants.length === 1 || years.size > 1) {
      merged.push(...variants);
      continue;
    }
    const target = [...variants].sort(
      (a, b) =>
        Number(/\b(?:19|20)\d{2}\b/.test(b.name)) -
          Number(/\b(?:19|20)\d{2}\b/.test(a.name)) || b.name.length - a.name.length,
    )[0];
    for (const variant of variants) {
      if (variant === target) continue;
      if (variant.href && !target.href) target.href = variant.href;
      for (const bare of variant.bare) {
        if (!target.bare.some((p) => p.toUpperCase() === bare.toUpperCase())) {
          target.bare.push(bare);
        }
      }
    }
    merged.push(target);
  }

  return merged.map(({ bare, ...row }) => {
    const sorted = [...bare].sort(compareProvisions);
    return {
      ...row,
      // The clerk's stray comma before a parenthetical ("Act, (CAMA), 2020")
      // is the one source blemish worth tidying for display.
      name: row.name.replace(/,\s*\(/g, ' ('),
      provisions:
        sorted.length === 0
          ? null
          : `${sorted.length === 1 ? 's' : 'ss'} ${sorted.join(', ')}`,
      searchHref: row.href
        ? null
        : `/statutes?search=${encodeURIComponent(statuteSearchTerm(row.name))}`,
    };
  });
}

/* ── The bench ───────────────────────────────────────────────────────────── */

export interface BenchJudge {
  key: string;
  name: string;
  role: CoramRole | null;
}

const ROLE_RANK: Record<CoramRole, number> = { lead: 0, concurring: 1, dissenting: 2 };

/**
 * Normalize the coram, tolerating the LEAN payload. The API sends bot user
 * agents (and some cached rows) judges as PLAIN STRINGS, not objects — the
 * first live run of the screenshot loop crashed the page on exactly that. The
 * lead judge sorts first because the lead judgment is the one the principles
 * quote.
 */
export function normalizeBench(
  judges: readonly (Judge | string | null | undefined)[] | null | undefined,
): BenchJudge[] {
  if (!Array.isArray(judges)) return [];
  const rows: BenchJudge[] = [];
  for (const [index, judge] of judges.entries()) {
    if (typeof judge === 'string') {
      const name = judge.trim();
      if (name) rows.push({ key: `name-${index}`, name, role: null });
      continue;
    }
    if (judge && typeof judge.name === 'string' && judge.name.trim()) {
      rows.push({
        key: `judge-${judge.id ?? index}`,
        name: judge.name.trim(),
        role: judge.role ?? null,
      });
    }
  }
  return rows.sort(
    (a, b) => (a.role ? ROLE_RANK[a.role] : 3) - (b.role ? ROLE_RANK[b.role] : 3),
  );
}

/* ── Small text helpers ──────────────────────────────────────────────────── */

/** Sentence-case a lowercase editorial string (topics, principle tags) without
 *  touching anything already cased — "company law — alteration" → "Company law
 *  — alteration", but "Corporate Affairs Commission approval" stays. */
export function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/* ── Inline authorities — the citations INSIDE the prose ─────────────────── */

/**
 * A judgment's text is itself a web of authorities: "See Ohiaeri v. Yussuf
 * (2009) 2 SCNJ 318, distinguished", "Section 598 of the Companies and Allied
 * Matters Act". On the old page that was dead ink. `extractAuthorityRefs`
 * finds those references so `CaseText` can render them as quiet library-search
 * links — the same click-runs-a-search semantics as an unlinked authority row,
 * now available mid-sentence. Sparse cases gain the most: they have no
 * authority lists at all, but their principles cite cases in every line.
 *
 * PRECISION OVER RECALL. A missed citation is invisible; a mis-linked span of
 * ordinary prose is broken typography. So a case reference must be CONFIRMED
 * by a "(year)" after the parties, and a statute reference must be anchored
 * on "section(s) … of the …" ending in an enactment word (Act, Constitution,
 * Law, Code, Rules, Decree, Edict).
 */
export interface AuthorityRef {
  kind: 'case' | 'statute';
  /** Character span of the LINKED text inside the paragraph. */
  start: number;
  end: number;
  href: string;
}

/** One word of a party name — allows initials, (Nig), R-Benkay, O'Neill. */
const NAME_WORD = String.raw`\(?[A-Z0-9][A-Za-z0-9'’.&-]*\)?,?`;
/** Lowercase words that legitimately sit INSIDE a party name. */
const NAME_JOIN = String.raw`(?:of|and|the|&|de|da)`;
const NAME_SEQ = String.raw`${NAME_WORD}(?:[ \t](?:${NAME_JOIN}|${NAME_WORD})){0,11}`;
/** "A v. B" confirmed by a following (year). The versus token is matched in
 *  any casing the clerks use — "v.", "Vs", "VS.", "vrs" — because raw text
 *  carries all of them ("General & Aviation Services Ltd Vs Thahal (2000)"
 *  was missed by a lowercase-only token on live data). */
const CASE_REF = new RegExp(
  String.raw`(${NAME_SEQ})[ \t](?:[Vv][Ss]?|VS|[Vv][Rr][Ss])\.?[ \t](${NAME_SEQ})(?=[ \t]*\((?:1[89]|20)\d{2}\))`,
  'g',
);
/** Sentence-lead words the left party expansion must not swallow. Wide on
 *  purpose: in ALL-CAPS judgment text every word looks like a name, so the
 *  expansion grabs "IT WAS HELD IN MACFOY…" and these peel back to the party.
 *  Only words that cannot OPEN a real party name belong here — "the" is safe
 *  ("The State v. X" still searches as "State v. X"); "state" is not. */
const LEAD_NOISE = new Set([
  'see', 'in', 'also', 'cf', 'cf.', 'compare', 'held', 'and', 'or', 'but',
  'the', 'a', 'an', 'of', 'however', 'thus', 'therefore', 'accordingly',
  'applying', 'following', 'citing', 'distinguishing', 'per', 'vide', 'e.g.',
  'i.e.', 'it', 'was', 'is', 'are', 'were', 'be', 'been', 'that', 'this',
  'these', 'those', 'as', 'at', 'by', 'on', 'to', 'for', 'from', 'with',
  'where', 'when', 'while', 'whether', 'because', 'since', 'so', 'if', 'then',
  'than', 'such', 'said', 'stated', 'laid', 'down', 'decided', 'decision',
  'case', 'authority', 'judgment', 'principle', 'rule',
]);

const STATUTE_REF = new RegExp(
  String.raw`\b[Ss]ections?[ \t]+[\d][\d()A-Za-z]*(?:(?:,[ \t]*|[ \t]+and[ \t]+|[ \t]*&[ \t]*|[ \t]*[-–][ \t]*)[\d][\d()A-Za-z]*)*[ \t]+of[ \t]+the[ \t]+((?:(?:[A-Z][A-Za-z0-9'’&-]*|of|and|the)[ \t]+){0,10}(?:Act|Constitution|Law|Code|Rules|Decree|Edict))\b`,
  'g',
);

export function extractAuthorityRefs(text: string): AuthorityRef[] {
  const refs: AuthorityRef[] = [];

  for (const match of text.matchAll(CASE_REF)) {
    let start = match.index;
    let left = match[1];
    // Peel sentence-lead words the greedy expansion swallowed ("See Ohiaeri
    // v. Yussuf" → link starts at "Ohiaeri").
    for (;;) {
      const firstWord = /^[^ \t]+[ \t]+/.exec(left);
      if (!firstWord) break;
      const bare = firstWord[0].trim().replace(/[.,]+$/, '').toLowerCase();
      if (!LEAD_NOISE.has(bare)) break;
      left = left.slice(firstWord[0].length);
      start += firstWord[0].length;
    }
    if (!left) continue;
    const end = match.index + match[0].length;
    const span = text.slice(start, end).replace(/\s+/g, ' ');
    refs.push({
      kind: 'case',
      start,
      end,
      href: `/cases?search=${encodeURIComponent(formatCaseName(span))}`,
    });
  }

  for (const match of text.matchAll(STATUTE_REF)) {
    let name = match[1];
    const start = match.index + match[0].length - name.length;
    let end = match.index + match[0].length;
    // Names can CONTINUE past the enactment word — "Constitution of the
    // Federal Republic of Nigeria" puts it first — so extend across a
    // trailing capitalized "of …" run.
    const tail = /^[ \t]of[ \t](?:the[ \t])?[A-Z][A-Za-z'’-]*(?:[ \t](?:[A-Z][A-Za-z'’-]*|of|the|and))*/.exec(
      text.slice(end),
    );
    if (tail) {
      end += tail[0].length;
      name += tail[0];
    }
    // A statute name inside an already-linked case span would nest links.
    if (refs.some((ref) => start < ref.end && end > ref.start)) continue;
    refs.push({
      kind: 'statute',
      start,
      end,
      href: `/statutes?search=${encodeURIComponent(statuteSearchTerm(name))}`,
    });
  }

  return refs.sort((a, b) => a.start - b.start);
}

/** Abbreviations whose trailing period does NOT end a legal sentence. */
const NON_TERMINAL = new Set([
  'v', 'vs', 'vrs', 'ltd', 'plc', 'co', 'inc', 'anor', 'ors',
  'cap', 'no', 'nos', 'p', 'pp', 'pt', 'pts', 'art', 'arts',
  's', 'ss', 'sec', 'secs', 'para', 'paras', 'ed', 'nig', 'op', 'cit', 'etc',
]);

/**
 * Split a single-paragraph flat `principles` passage into its statements.
 *
 * WHY. The pre-enrichment corpus often fuses several holdings into ONE
 * paragraph — an eight-line serif wall (the owner's July 30 screenshot,
 * Dyktrude v Omnia). Editors write those as one sentence per holding, so a
 * CONSERVATIVE sentence split turns the wall into air: split only after a
 * period followed by a capital opening, and re-join whenever the previous
 * chunk ends in a legal abbreviation ("Cap.", "No.", "Ltd.", "v."), an
 * initial, or is too short to be a statement. A wrong re-join costs nothing
 * (two holdings share a block); the split is never trusted with NUMBERS —
 * only blank lines, an author's own boundaries, earn numerals.
 */
export function splitPrincipleStatements(text: string): string[] {
  const candidates = text.split(/(?<=\.)\s+(?=[A-Z"“(])/);
  const out: string[] = [];
  for (const candidate of candidates) {
    const part = candidate.trim();
    if (!part) continue;
    const prev = out[out.length - 1];
    if (prev) {
      const lastWord = prev.split(/\s+/).pop() ?? '';
      const bare = lastWord.replace(/[.)"'”’]+$/g, '').toLowerCase();
      if (NON_TERMINAL.has(bare) || bare.length <= 1 || prev.length < 60) {
        out[out.length - 1] = `${prev} ${part}`;
        continue;
      }
    }
    out.push(part);
  }
  return out;
}

/** The `law_type` classifications, known by contract. */
const LAW_TYPES: Record<string, string> = {
  substantive: 'Substantive',
  procedural: 'Procedural',
};

/**
 * Label a principle's `law_type` array — "Substantive law", "Procedural law",
 * or "Substantive & procedural law" when a principle is both (the contract
 * allows it). The " law" suffix only attaches when every value is a known
 * classification; an unknown future value renders sentence-cased as-is rather
 * than gaining a suffix that may not fit it.
 */
export function lawTypeLabel(values: readonly string[] | null | undefined): string | null {
  if (!values || values.length === 0) return null;
  const allKnown = values.every((value) => LAW_TYPES[value] !== undefined);
  const labels = values.map((value, index) => {
    const label = LAW_TYPES[value] ?? sentenceCase(value);
    return index === 0 ? label : label.toLowerCase();
  });
  return labels.join(' & ') + (allKnown ? ' law' : '');
}
