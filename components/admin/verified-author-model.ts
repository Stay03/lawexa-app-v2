/** What a verified author may do, under the switch (Arthur, 31 October 2026). */
export const VERIFIED_AUTHOR_HINT =
  "Can list quizzes for everyone. Their published public notes are used in Lawexa's AI answers.";

/** The toast after a change, in the admin's words. */
export function verifiedAuthorToast(name: string, isVerifiedAuthor: boolean): string {
  return isVerifiedAuthor ? `${name} is now a verified author` : `${name} is no longer a verified author`;
}
