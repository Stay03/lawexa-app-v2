/**
 * formatCaseName — turn an ALL-CAPS law-report heading into a readable case
 * name: "WILSON V. C.O.P" → "Wilson v. C.O.P".
 *
 * WHY. The corpus stores party names in capitals, and a page of capitals is the
 * single hardest thing to scan on the old case screens — every heading, every
 * related-case row, every judge shouted equally. Legal publishers set case
 * names in mixed case with a lowercase "v."; this reproduces that convention
 * mechanically.
 *
 * THE RULES ARE DELIBERATELY CONSERVATIVE — when in doubt, a token is left
 * exactly as it came, because a wrongly-lowercased acronym ("Nnpc") reads as an
 * error while an un-transformed word ("STATE" among "State"s) merely reads as
 * the source data. In order:
 *
 *  1. A name that already contains lowercase letters is returned VERBATIM —
 *     it is already cased, and re-casing it could only damage it.
 *  2. The versus token (V / V. / VS / VS. / VRS / VRS.) becomes lowercase "v."
 *     — the one transformation every law report agrees on.
 *  3. Tokens carrying digits, or wrapped in brackets/parentheses, are left
 *     alone: they are citations, years, and suit numbers.
 *  4. Tokens with INTERNAL punctuation dots (C.O.P, A.G., I.G.P.) are initials
 *     and stay uppercase; so do single letters.
 *  5. A token with NO vowels (NNPC, FRN, PLC, JSC, JCA, NWLR) is read as an
 *     acronym and stays uppercase — a real word always has a vowel.
 *  6. A short list of known report abbreviations that DO contain vowels but
 *     must keep their conventional casing (LTD → Ltd, ORS → Ors, …).
 *  7. Small connective words (OF, THE, AND, FOR, IN) are lowercased — except
 *     as the first word of a party name (the start of the string, or right
 *     after the versus token, a semicolon, or a comma-space boundary is left
 *     capitalized via the "start of a party" check below).
 *  8. Everything else: first letter up, rest down — per hyphen- and
 *     apostrophe-separated segment, so OKO-OSI → Oko-Osi and O'NEILL → O'Neill.
 *
 * Callers keep the ORIGINAL string in a `title` attribute, so the source form
 * is always one hover away.
 */

const VERSUS = /^(v|vs|vrs)\.?$/i;

/** Words that stay lowercase mid-name (rule 7). `AT` earns its place from
 *  pinpoint citations ("…(PT. 75) 156 AT 177") surviving inside fused titles. */
const CONNECTIVES = new Set(['OF', 'THE', 'AND', 'FOR', 'IN', 'AT']);

/** Vowel-bearing abbreviations whose conventional casing is fixed (rule 6). */
const KNOWN: Record<string, string> = {
  LTD: 'Ltd',
  'LTD.': 'Ltd.',
  ORS: 'Ors',
  'ORS.': 'Ors.',
  ANOR: 'Anor',
  'ANOR.': 'Anor.',
  ALHAJI: 'Alhaji',
  EX: 'Ex',
  PARTE: 'Parte',
  'PARTE:': 'Parte:',
};

/** Case one word-like segment (rule 8's inner step). */
function caseSegment(segment: string): string {
  if (segment.length === 0) return segment;
  return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
}

function caseToken(token: string, atPartyStart: boolean): string {
  // Rule 2 — the versus token. Trailing punctuation (rare "V.,") survives.
  if (VERSUS.test(token)) return token.replace(/^(v|vs|vrs)/i, (m) => m.toLowerCase());

  // Rule 3 — citations, years, numbers, bracketed report references.
  if (/[0-9()[\]]/.test(token)) return token;

  // Strip trailing sentence punctuation for classification; re-attach after.
  const trailing = token.match(/[,;:]+$/)?.[0] ?? '';
  const core = trailing ? token.slice(0, -trailing.length) : token;
  if (core.length === 0) return token;

  // Rule 4 — initials and single letters.
  if (core.length === 1) return token;
  if (core.slice(0, -1).includes('.')) return token;

  // Rule 6 — known abbreviations (checked before the vowel heuristic so the
  // map is authoritative either way).
  const known = KNOWN[core.toUpperCase()];
  if (known !== undefined) return known + trailing;

  // Rule 5 — no vowels ⇒ acronym.
  if (!/[AEIOUY]/i.test(core)) return token;

  // Rule 7 — connectives, only when not opening a party name.
  if (!atPartyStart && CONNECTIVES.has(core.toUpperCase())) {
    return core.toLowerCase() + trailing;
  }

  // Rule 8 — an ordinary word, cased per hyphen/apostrophe segment.
  const cased = core
    .split('-')
    .map((part) => part.split("'").map(caseSegment).join("'"))
    .join('-');
  return cased + trailing;
}

export function formatCaseName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return trimmed;

  // Rule 1 — already mixed-case: hands off.
  if (/[a-z]/.test(trimmed)) return trimmed;

  const tokens = trimmed.split(/\s+/);
  const out: string[] = [];
  // "Start of a party name": the string start, and the token after a versus
  // token or after a token ending in ; or : — those open a new name, where
  // even a connective ("The Federal Republic…") keeps its capital.
  let atPartyStart = true;

  for (const token of tokens) {
    out.push(caseToken(token, atPartyStart));
    atPartyStart = VERSUS.test(token) || /[;:]$/.test(token);
  }

  return out.join(' ');
}

/**
 * The first citation of a possibly multi-citation string — `citation` fields
 * routinely carry two report references separated by ';' ("(2026) JELR 115357
 * (CA); (2026) LAWEXA ELR 11797 NG CAPH"), and a list row only has room to
 * earn the first.
 */
export function firstCitation(citation: string | null): string | null {
  if (!citation) return null;
  const first = citation.split(';')[0]?.trim();
  return first || null;
}
