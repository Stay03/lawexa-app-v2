import type { Wrapped26Track } from './types';

/**
 * The cast (Arthur's build kit, data/characters.json, 21 November 2026). The
 * server picks the character and sends only its name; the app keeps the rest
 * (show credit, accent, lines) so the wheel can hold the whole cast. Text
 * only: no stills, photos or likenesses of actors or shows.
 */

export type Wrapped26Accent = 'gold' | 'lilac' | 'coral' | 'lime';

export interface Wrapped26Character {
  name: string;
  show: string;
  accent: Wrapped26Accent;
  /** The practitioner's line. */
  line: string;
  /** A student's line: never implies they already practise. */
  studentLine: string;
  archetype: string;
  studentArchetype: string;
  tracks: Wrapped26Track[];
}

export const WRAPPED26_CHARACTERS: readonly Wrapped26Character[] = [
  {
    name: 'Victoria Atem',
    show: 'Agu (2023)',
    accent: 'coral',
    line: 'The Relentless. Doesn’t stop until she has the authority that wins it.',
    studentLine: 'The Relentless. Doesn’t stop until she has the authority that wins it.',
    archetype: 'Authority Hunter',
    studentArchetype: 'Authority Hunter',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Louis Litt',
    show: 'Suits (2011)',
    accent: 'lime',
    line: 'The Perfectionist. Every citation checked twice.',
    studentLine: 'The Perfectionist. Every citation checked twice.',
    archetype: 'Brief Perfectionist',
    studentArchetype: 'Brief Perfectionist',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Annalise Keating',
    show: 'How to Get Away with Murder (2014)',
    accent: 'coral',
    line: 'The Courtroom Force. Born to argue.',
    studentLine: 'The Moot Court Menace. Born to argue.',
    archetype: 'Courtroom Natural',
    studentArchetype: 'Courtroom Natural',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Kim Wexler',
    show: 'Better Call Saul (2015)',
    accent: 'lilac',
    line: 'The Quiet Achiever. Substance over noise.',
    studentLine: 'The Quiet Achiever. Substance over noise.',
    archetype: 'Quiet Strategist',
    studentArchetype: 'Quiet Strategist',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Saul Goodman',
    show: 'Better Call Saul (2015)',
    accent: 'coral',
    line: 'The Improviser. Finds another gear when the clock runs out.',
    studentLine: 'The Improviser. Finds another gear when the clock runs out.',
    archetype: 'Deadline Sprinter',
    studentArchetype: 'Deadline Sprinter',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Tega Castle',
    show: 'Castle & Castle (2018)',
    accent: 'lilac',
    line: 'The Principled Counsel. In it for the law itself.',
    studentLine: 'The Principled Counsel. In it for the law itself.',
    archetype: 'Legal Scholar',
    studentArchetype: 'Legal Scholar',
    tracks: ['lawyers'],
  },
  {
    name: 'Elle Woods',
    show: 'Legally Blonde (2001)',
    accent: 'lilac',
    line: 'What, like it’s hard? In it for the love of the law.',
    studentLine: 'What, like it’s hard? In it for the love of the law.',
    archetype: 'Legal Scholar',
    studentArchetype: 'Legal Scholar',
    tracks: ['undergraduates'],
  },
  {
    name: 'Remi Castle',
    show: 'Castle & Castle (2018)',
    accent: 'gold',
    line: 'The Commercial Powerhouse. Sees the business behind the brief.',
    studentLine: 'The Future Powerhouse. Sees the business behind the problem.',
    archetype: 'Deal Maker',
    studentArchetype: 'Commercial Mind',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Harvey Specter',
    show: 'Suits (2011)',
    accent: 'gold',
    line: 'The Closer. Plays the other side’s hand before they do.',
    studentLine: 'The Closer. Plays the other side’s hand before they do.',
    archetype: 'Devil’s Advocate',
    studentArchetype: 'Devil’s Advocate',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Donna Paulsen',
    show: 'Suits (2011)',
    accent: 'lilac',
    line: 'The One Who Knows Everything. Saw it before you did.',
    studentLine: 'The One Who Knows Everything. Saw it before you did.',
    archetype: 'Paper Trail Detective',
    studentArchetype: 'Paper Trail Detective',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Mike Ross',
    show: 'Suits (2011)',
    accent: 'lime',
    line: 'The Natural. Reads everything, remembers everything.',
    studentLine: 'The Natural. Reads everything. (He wasn’t technically a lawyer either.)',
    archetype: 'Research Rabbit',
    studentArchetype: 'Research Rabbit',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Jessica Pearson',
    show: 'Suits (2011)',
    accent: 'gold',
    line: 'The Name on the Door. Across every area, in command.',
    studentLine: 'The Future Name on the Door. Across every area, in command.',
    archetype: 'All-Round Counsel',
    studentArchetype: 'All-Rounder',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Jenifa',
    show: 'Jenifa’s Diary (2015)',
    accent: 'lime',
    line: 'The Come-Up Story. Always finding a way to level up.',
    studentLine: 'The Come-Up Story. Always finding a way to level up.',
    archetype: 'Rising Counsel',
    studentArchetype: 'One to Watch',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Etim Inyang',
    show: 'Agu (2023)',
    accent: 'coral',
    line: 'The Comeback. Away for a while, back stronger.',
    studentLine: 'The Comeback. Away for a while, back stronger.',
    archetype: 'The Comeback',
    studentArchetype: 'The Comeback',
    tracks: ['lawyers', 'undergraduates'],
  },
  {
    name: 'Eniola Salami',
    show: 'King of Boys (2018)',
    accent: 'gold',
    line: 'The Power Player. Top 2% of activity in your track.',
    studentLine: 'The Power Player. Top 2% of activity in your track.',
    archetype: 'Power Player',
    studentArchetype: 'Power Player',
    tracks: ['lawyers', 'undergraduates'],
  },
];

/** The wheel's segments: the track's cast, in the kit's order (14 for each track). */
export function castFor(track: Wrapped26Track): Wrapped26Character[] {
  return WRAPPED26_CHARACTERS.filter((character) => character.tracks.includes(track));
}

/**
 * The record's character, or null when the name is not in the track's cast
 * (a character added on the server before the app knows it). The player then
 * shows the reveal without the wheel's accent, never a blank slide.
 */
export function characterFor(track: Wrapped26Track, name: string): Wrapped26Character | null {
  return castFor(track).find((character) => character.name === name) ?? null;
}
