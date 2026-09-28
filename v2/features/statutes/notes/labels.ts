/**
 * Where a note sits, in the words a lawyer cites: "s. 47(1)(a)", "Part IV",
 * "Form TF 001". Read from the note's eId, which the export writes as the
 * part's path (`part-iv__sec-47__subsec-1__para-a`), so the list can name a
 * place without the part being mounted.
 */

const LEVEL_WORDS: Record<string, string> = {
  part: 'Part',
  chp: 'Chapter',
  chapter: 'Chapter',
  sched: 'Schedule',
  schedule: 'Schedule',
  att: 'Attachment',
  group: '',
};

/** One eId segment ("sec-47", "subsec-1", "group-tf-001") as its kind and value. */
function splitSegment(segment: string): { kind: string; value: string } {
  const dash = segment.indexOf('-');
  if (dash === -1) return { kind: segment, value: '' };
  return { kind: segment.slice(0, dash), value: segment.slice(dash + 1) };
}

/** "tf-001" → "TF 001"; "iv" → "IV"; "2a" → "2A". */
function upperValue(value: string): string {
  return value.replace(/-/g, ' ').toUpperCase();
}

export function partLabel(eid: string): string {
  const segments = eid.split('__').filter(Boolean).map(splitSegment);
  const section = segments.findIndex((s) => s.kind === 'sec' || s.kind === 'art' || s.kind === 'reg' || s.kind === 'rule');

  if (section !== -1) {
    const head = segments[section];
    const prefix = head.kind === 'sec' ? 's.' : head.kind === 'art' ? 'art.' : head.kind === 'reg' ? 'reg.' : 'r.';
    const tail = segments
      .slice(section + 1)
      .map((s) => (s.value ? `(${s.value})` : ''))
      .join('');
    return `${prefix} ${head.value}${tail}`;
  }

  // No section: name the deepest part ("Form TF 001", "Part IV", "Schedule 2").
  const last = segments[segments.length - 1];
  if (!last) return eid;
  if (last.kind === 'group' && /^tf|^ec|^form/i.test(last.value)) {
    return `Form ${upperValue(last.value.replace(/^form-?/i, ''))}`;
  }
  const word = LEVEL_WORDS[last.kind];
  if (word === undefined) return upperValue(`${last.kind} ${last.value}`).trim();
  return `${word} ${upperValue(last.value)}`.trim();
}
