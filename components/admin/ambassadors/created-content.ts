import type {
  AmbassadorCreatedContent,
  AmbassadorQuizTally,
  AmbassadorSpaceTally,
} from '@/types/ambassador';

/**
 * What an ambassador's referrals have made (Arthur's option A, via Richard,
 * 3 November 2026): the Spaces they created, with how many members each has,
 * and the quizzes they created, with how many times each was played.
 *
 * The counts sit in the financials table beside the money, and the lists in
 * the ambassador's detail. Like the rest of the screen they count what the
 * REFERRED PEOPLE did, so the headers say "Their referrals'", as "Their
 * referrals spent" does. Pure, so a test pins each rule.
 */

const NO_SPACES: AmbassadorSpaceTally = { count: 0, members: 0 };
const NO_QUIZZES: AmbassadorQuizTally = { count: 0, plays: 0 };

/** A whole number of zero or more, else zero: a missing or broken count reads as none. */
function whole(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;
}

/** A row's or the totals' Spaces, with zeros from a server before them. */
export function spacesOf(tally: Partial<AmbassadorSpaceTally> | null | undefined): AmbassadorSpaceTally {
  if (!tally) return NO_SPACES;
  return { count: whole(tally.count), members: whole(tally.members) };
}

/** A row's or the totals' quizzes, with zeros from a server before them. */
export function quizzesOf(tally: Partial<AmbassadorQuizTally> | null | undefined): AmbassadorQuizTally {
  if (!tally) return NO_QUIZZES;
  return { count: whole(tally.count), plays: whole(tally.plays) };
}

export function memberLabel(members: number): string {
  return members === 1 ? '1 member' : `${members} members`;
}

export function playLabel(plays: number): string {
  return plays === 1 ? '1 play' : `${plays} plays`;
}

export interface CreatedSpaceRow {
  uuid: string;
  name: string;
  detail: string;
  createdAt: string;
}

export interface CreatedQuizRow {
  uuid: string;
  title: string;
  detail: string;
  createdAt: string;
}

/**
 * The detail's two lists, in the server's order (newest first). A blank name
 * reads as "Untitled", never as an empty line.
 */
export function createdContentRows(content: Partial<AmbassadorCreatedContent> | null | undefined): {
  spaces: CreatedSpaceRow[];
  quizzes: CreatedQuizRow[];
} {
  return {
    spaces: (content?.spaces ?? []).map((space) => ({
      uuid: space.uuid,
      name: space.name?.trim() || 'Untitled Space',
      detail: memberLabel(whole(space.members)),
      createdAt: space.created_at,
    })),
    quizzes: (content?.quizzes ?? []).map((quiz) => ({
      uuid: quiz.uuid,
      title: quiz.title?.trim() || 'Untitled quiz',
      detail: playLabel(whole(quiz.plays)),
      createdAt: quiz.created_at,
    })),
  };
}
