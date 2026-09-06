/**
 * Party and counsel names arrive from the provider in the cover's capitals,
 * and the provider will not case them for us on purpose: their own note says
 * title-casing mangles "A.-G.", "(NIG)" and "INEC", so they leave it to the
 * side that renders. This is that side.
 *
 * ── THE STORED VALUE IS ALWAYS THE PRINT ──────────────────────────────────
 * Nothing here is written back. `case_parties.name` and
 * `case_counsel_people.name` keep the cover's capitals, so our column and the
 * provider's stay byte-identical and a casing difference can never read as a
 * disagreement in the compare view. Casing happens at render, every time.
 */

/**
 * Tokens that keep their printed form, whatever the rules below would do.
 *
 * Each one is here because title-casing it produces something wrong rather
 * than merely ugly: "A.-g." and "Inec" are not names anybody writes. Add to
 * this list rather than loosening the rules; a wrong entry only affects the
 * names that contain it.
 */
const KEEP_AS_PRINTED = new Set([
  'A.-G.',
  'A.-G',
  'INEC',
  'NIG',
  'NIG.',
  'NNPC',
  'FCT',
  'FCDA',
  'NPA',
  'UBA',
  'PDP',
  'APC',
  'SAN',
  // The national honours, the same list the counsel splitter reads as
  // post-nominals: title-cased they turn into words that look like surnames.
  'OFR',
  'CFR',
  'CON',
  'GCON',
  'MFR',
  'OON',
  'MON',
]);

/**
 * Lower-cased inside a name, never at the start of one.
 *
 * "ATTORNEY-GENERAL OF OYO STATE" reads as "Attorney-General of Oyo State";
 * "OF" capitalised in the middle of a name looks like a mistake to a lawyer.
 */
const MINOR = new Set(['of', 'the', 'and', 'for', 'v', 'vs', 'in', 'on', 'to', 'de', 'la']);

/**
 * An initial: one letter and a stop, possibly several run together.
 *
 * "A.M.", "F.O.", "S." and "G." must stay upper. This is the rule that a plain
 * title-case gets wrong most often, because it lowercases everything after the
 * first character of the token and turns "A.M. ADELEYE" into "A.m. Adeleye".
 */
const INITIALS = /^(?:[A-Za-z]\.){1,4}$/;

/** A token already carrying a lower-case letter was not shouted; leave it. */
function alreadyCased(token: string): boolean {
  return /[a-z]/.test(token);
}

function capitaliseWord(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Case one whitespace-separated token, keeping the pieces of a hyphenated or
 * apostrophed name: "KARIBI-WHYTE" is two names, "O'BRIEN" is one with a
 * capital after the apostrophe.
 */
function caseToken(token: string, isFirst: boolean): string {
  if (!token) return token;
  if (KEEP_AS_PRINTED.has(token)) return token;
  if (INITIALS.test(token)) return token.toUpperCase();
  if (alreadyCased(token)) return token;
  if (!/[A-Za-z]/.test(token)) return token;

  // Punctuation the token opens or closes with travels unchanged, so
  // "(NIG)" is tested as NIG and "OYO," keeps its comma.
  const open = token.match(/^[^A-Za-z0-9]*/)?.[0] ?? '';
  const close = token.match(/[^A-Za-z0-9]*$/)?.[0] ?? '';
  const core = token.slice(open.length, token.length - close.length);
  if (!core) return token;
  if (KEEP_AS_PRINTED.has(core)) return open + core + close;

  const lower = core.toLowerCase();
  if (!isFirst && MINOR.has(lower)) return open + lower + close;

  const cased = core
    .split(/([-'’])/)
    .map((part) => (part === '-' || part === "'" || part === '’' ? part : capitaliseWord(part)))
    .join('');

  return open + cased + close;
}

/**
 * Render a printed party or counsel name for a reader.
 *
 * Returns the input unchanged when it is not in capitals, so a provider that
 * one day sends cased names, or a hand-corrected value, passes straight
 * through rather than being re-cased into something else.
 */
export function casePartyName(printed: string | null | undefined): string {
  if (!printed) return '';
  const trimmed = printed.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';

  // A name with any lower-case letter outside brackets was not shouted at us.
  const outsideBrackets = trimmed.replace(/\([^)]*\)/g, '');
  if (/[a-z]/.test(outsideBrackets)) return trimmed;

  const tokens = trimmed.split(' ');
  let seenWord = false;
  return tokens
    .map((token) => {
      const isFirst = !seenWord;
      if (/[A-Za-z]/.test(token)) seenWord = true;
      return caseToken(token, isFirst);
    })
    .join(' ');
}
