/**
 * Spoken commands while dictating (Arthur, 25 November 2026, thread ce4eb347:
 * design A with C's spoken commands). A command acts only when it is the LAST
 * thing said before a pause: the live transcriber settles a segment
 * (`committed_transcript`) after about 1.5 seconds of silence, and only a
 * settled segment is read here. "Send the letter to my landlord" goes on past
 * "send", so it is words, never a command.
 *
 * Stopping is sending (Arthur: "you can only stop if you want to send"), so
 * "end dictation" and "I'm done" send too. The command's words are taken out
 * of the message; what came before them in the segment stays.
 *
 * English only for now (the research, 25 November 2026: commands work in the
 * languages we add; the words themselves are transcribed in about 90).
 */

export type DictationCommand = 'send' | 'pause' | 'cancel';

export interface CommandRead {
  command: DictationCommand | null;
  /** The segment without the command's words (and the punctuation around them). */
  text: string;
}

/** Trailing phrases, longest first so "send it" is not read as "send". */
const PHRASES: readonly { words: string; command: DictationCommand }[] = [
  { words: "that's it send it", command: 'send' },
  { words: "that's it send", command: 'send' },
  { words: "i'm done send it", command: 'send' },
  { words: "i'm done send", command: 'send' },
  { words: 'end dictation', command: 'send' },
  { words: 'send it now', command: 'send' },
  { words: 'send it', command: 'send' },
  { words: 'send now', command: 'send' },
  { words: 'send', command: 'send' },
  { words: 'pause dictation', command: 'pause' },
  { words: 'pause', command: 'pause' },
  { words: 'cancel dictation', command: 'cancel' },
  { words: 'cancel', command: 'cancel' },
];

/** Words as the transcriber writes them, compared without case, punctuation or curly quotes. */
function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Whether a settled segment ends in a command, and the segment without it.
 * The command must be its own last words: "I'll send" is a command only when
 * "send" is the segment's last word, and then "I'll" stays as words.
 */
export function readCommand(segment: string): CommandRead {
  const words = wordsOf(segment);
  for (const phrase of PHRASES) {
    const tail = phrase.words.split(' ');
    if (words.length < tail.length) continue;
    const end = words.slice(words.length - tail.length);
    if (end.every((word, i) => word === tail[i])) {
      return { command: phrase.command, text: withoutTrailingWords(segment, tail.length) };
    }
  }
  return { command: null, text: segment };
}

/**
 * The segment cut where its last `count` words begin. The sentence before
 * keeps its own full stop or question mark; a comma or dash that only led
 * into the command goes.
 */
function withoutTrailingWords(segment: string, count: number): string {
  const starts = [...segment.matchAll(/[A-Za-z0-9’‘']+/g)].map((match) => match.index ?? 0);
  const cut = starts[starts.length - count] ?? 0;
  return segment.slice(0, cut).replace(/[\s,;:–—-]+$/u, '').trim();
}

/** The commands the transcriber should expect, for its keyterms (the server adds them too). */
export const COMMAND_KEYTERMS: readonly string[] = ['send', 'send it', "I'm done, send", 'end dictation', 'pause', 'cancel'];
