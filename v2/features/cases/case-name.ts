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

/** Vowel-bearing abbreviations whose conventional casing is fixed (rule 6).
 *  The judicial honorifics are here because the vowel heuristic misreads the
 *  ones that contain vowels — live data showed "MUHAMMAD JCA" rendering as
 *  "Muhammad Jca" (A is a vowel, so JCA failed the acronym test) while JSC,
 *  vowel-free, was correct. The map outranks the heuristic. */
const KNOWN: Record<string, string> = {
  LTD: 'Ltd',
  'LTD.': 'Ltd.',
  // PLC is vowel-free so rule 5 would keep it shouting; publishers write "Plc".
  PLC: 'Plc',
  'PLC.': 'Plc.',
  ORS: 'Ors',
  'ORS.': 'Ors.',
  ANOR: 'Anor',
  'ANOR.': 'Anor.',
  ALHAJI: 'Alhaji',
  EX: 'Ex',
  PARTE: 'Parte',
  'PARTE:': 'Parte:',
  // Judicial honorifics and post-nominals (Nigeria + Ghana benches).
  JCA: 'JCA',
  JSC: 'JSC',
  CJN: 'CJN',
  SAN: 'SAN',
  OFR: 'OFR',
  GCON: 'GCON',
  ACJ: 'ACJ',
  PCA: 'PCA',
  // Report-series abbreviations that carry a vowel (the vowel-free ones — NWLR,
  // FWLR, SCNJ — already pass rule 5). Live data showed "Lpelr-13034".
  LPELR: 'LPELR',
  JELR: 'JELR',
  LELR: 'LELR',
  // Institutional acronyms that carry a vowel and appear as PARTIES in the
  // corpus ("MACFOY V. UAC" rendered as "Macfoy v. Uac" on live data). The
  // list is curated, not guessed: each is a household initialism in Nigerian
  // reports and none is a plausible word in a case name.
  UAC: 'UAC',
  UBA: 'UBA',
  NEPA: 'NEPA',
  NDIC: 'NDIC',
  INEC: 'INEC',
  NAFDAC: 'NAFDAC',
  CAC: 'CAC',
  FIRS: 'FIRS',
  NBA: 'NBA',
  JAMB: 'JAMB',
  WAEC: 'WAEC',
  NECO: 'NECO',
  ICPC: 'ICPC',
  EFCC: 'EFCC',
  NICON: 'NICON',
};

/** Case one word-like segment (rule 8's inner step). */
function caseSegment(segment: string): string {
  if (segment.length === 0) return segment;
  return segment[0].toUpperCase() + segment.slice(1).toLowerCase();
}

function caseToken(token: string, atPartyStart: boolean): string {
  // Rule 2 — the versus token, normalized to "v" (keeping its dot if it had
  // one, and any trailing punctuation — rare "V.," survives). Longest
  // alternative FIRST: `(v|vs|vrs)` would match the bare "v" of "VS." and
  // leave "vS." behind — a live bug this order fixes.
  if (VERSUS.test(token)) return token.replace(/^(?:vrs|vs|v)/i, 'v');

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

  // Rule 8 — an ordinary word, cased per hyphen segment. After an apostrophe,
  // capitalize only when the prefix is a single letter (O'NEILL → O'Neill) —
  // longer prefixes keep the rest lowercase (AKA'AHS → Aka'ahs, the publishers'
  // form for such names).
  const cased = core
    .split('-')
    .map((part) => {
      const pieces = part.split("'");
      return pieces
        .map((piece, i) =>
          i === 0 || pieces[i - 1].length === 1 ? caseSegment(piece) : piece.toLowerCase(),
        )
        .join("'");
    })
    .join('-');
  return cased + trailing;
}

export function formatCaseName(name: string | null | undefined): string {
  // Nullable by design: the lean bot-UA payload omits fields the full payload
  // carries, and this formatter sits on nearly every render path — it must
  // degrade to '' rather than throw (the first screenshot-loop run found the
  // page crashing on exactly this).
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0) return trimmed;

  // Rule 1 — already mixed-case: hands off, EXCEPT the versus token. Two
  // subtleties, both from live rows:
  //  - publishers write a lowercase "v." even in otherwise ALL-CAPS headings
  //    ("OKAFOR v. NWEKE") — so the token is excluded from the probe, and one
  //    lowercase letter cannot veto the transformation the rest needs;
  //  - a cased name may still carry the "vs." variant ("Ibrahim vs. INEC"),
  //    and normalizing THAT to "v." is safe on any name — so it applies even
  //    on this verbatim path. A bare "v" is left alone here: cased titles from
  //    the API use it as their house style, and re-dotting them is not ours to
  //    do.
  const probe = trimmed.replace(/\b(?:vs?|vrs)\.?(?=\s|$)/gi, '');
  if (/[a-z]/.test(probe)) {
    return trimmed.replace(/(\s)(?:vrs|vs)(\.?)(?=\s)/gi, '$1v$2');
  }

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
