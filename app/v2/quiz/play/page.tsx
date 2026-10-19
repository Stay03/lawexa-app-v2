import { redirect } from 'next/navigation';

/**
 * v1's quiz resume link, `/quiz/play?s={session}`: the session is its own
 * address in v2 (`/quiz/{session}`), so an old link resumes the quiz instead of
 * reading "play" as an unknown session (v2 Stage 1, item 3). A link with no
 * session goes to the quiz hub, as v1's page did.
 */
export default async function V2QuizPlayRedirect({
  searchParams,
}: {
  searchParams: Promise<{ s?: string | string[] }>;
}) {
  const { s } = await searchParams;
  const session = Array.isArray(s) ? s[0] : s;
  redirect(session ? `/quiz/${encodeURIComponent(session)}` : '/quiz');
}
