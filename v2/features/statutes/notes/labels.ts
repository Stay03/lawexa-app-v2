/**
 * Where a note sits, in the words a lawyer cites: "s. 47(1)(a)", "Part IV",
 * "Sch. 1, para 25(2)", "Form TF 001". Read from the note's eId, which the
 * export writes as the part's path (`part-iv__sec-47__subsec-1__para-a`,
 * `att-1__paragraph-25__subpara-2`), so the list can name a place without
 * the part being mounted. `att-N` is the Nth schedule.
 */

interface Segment {
  kind: string;
  value: string;
}

/** One eId segment ("sec-47", "subsec-1", "group-tf-001") as its kind and value. */
function splitSegment(segment: string): Segment {
  const dash = segment.indexOf('-');
  if (dash === -1) return { kind: segment, value: '' };
  return { kind: segment.slice(0, dash), value: segment.slice(dash + 1) };
}

/** "tf-001" → "TF 001"; "iv" → "IV"; "2a" → "2A". */
function upperValue(value: string): string {
  return value.replace(/-/g, ' ').toUpperCase();
}

/** Every segment after the first numbered one reads as a bracket: (1)(a)(iii). */
function brackets(segments: readonly Segment[]): string {
  return segments.map((s) => (s.value ? `(${s.value})` : '')).join('');
}

const SECTION_PREFIX: Record<string, string> = { sec: 's.', art: 'art.', reg: 'reg.', rule: 'r.' };

export function partLabel(eid: string): string {
  const segments = eid.split('__').filter(Boolean).map(splitSegment);
  if (segments.length === 0) return eid;

  // A section (or article, regulation, rule) and its subdivisions: "s. 47(1)(a)".
  const section = segments.findIndex((s) => s.kind in SECTION_PREFIX);
  if (section !== -1) {
    const head = segments[section];
    return `${SECTION_PREFIX[head.kind]} ${head.value}${brackets(segments.slice(section + 1))}`;
  }

  // A printed form stands on its own: "Form TF 001".
  const form = segments.find((s) => s.kind === 'group' && /^(tf|ec|form)/i.test(s.value));
  if (form) return `Form ${upperValue(form.value.replace(/^form-?/i, ''))}`;

  // Otherwise the path, divisions first: "Sch. 1, Part III, para 25(2)".
  const words: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (s.kind === 'att') words.push(`Sch. ${s.value}`);
    else if (s.kind === 'part') words.push(`Part ${upperValue(s.value)}`);
    else if (s.kind === 'chp' || s.kind === 'chapter') words.push(`Chapter ${upperValue(s.value)}`);
    else if (s.kind === 'paragraph' || s.kind === 'item') {
      words.push(`${s.kind === 'paragraph' ? 'para' : 'item'} ${s.value}${brackets(segments.slice(i + 1))}`);
      break;
    }
    // `group` (a crossheading's group) and `text` add nothing a reader cites.
  }
  if (words.length === 0) return upperValue(`${segments[0].kind} ${segments[0].value}`).trim();
  // A schedule alone reads in full: "Schedule 3", not "Sch. 3".
  if (words.length === 1 && words[0].startsWith('Sch. ')) return `Schedule ${words[0].slice(5)}`;
  return words.join(', ');
}
