import { cache } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { format, isValid, parseISO } from 'date-fns';
import { Trophy } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fetchPublicQuizResults } from '@/lib/api/server';
import { SEO, getAppUrl } from '@/lib/constants/seo';
import { publicQuizResultsPath } from '@/lib/constants/quiz-share';
import { cn } from '@/lib/utils';
import { getInitials } from '@/lib/utils/collab';
import type {
  PublicQuizGameResults,
  PublicQuizPodiumRow,
} from '@/types/channel-quiz';

/**
 * `/quiz-results/[gameUuid]` — a finished channel quiz's podium, for anyone
 * holding the link.
 *
 * ── WHY IT IS NOT A v2 ROUTE ───────────────────────────────────────────────
 * Everything else about this feature lives in `v2/`, and this page deliberately
 * does not. A path listed in `v2/routes.manifest.ts` is only rewritten into the
 * v2 tree for a reader carrying the `lawexa-ui=v2` cookie (see `proxy.ts`), and
 * the entire point of this page is that it opens for someone who has never seen
 * this app before. Left out of the manifest, the proxy passes it through and one
 * page answers for everybody — cookie, no cookie, signed in, signed out.
 *
 * That also puts it on the v1 side of the import boundary, so it reaches for the
 * shared layers only: `components/ui`, `lib/api`, `lib/constants`, `lib/utils`,
 * `types`. Nothing here imports from `v2/`, and the one value that BOTH sides
 * need — the link's own shape — lives in `lib/constants/quiz-share.ts`.
 *
 * ── A SERVER COMPONENT, BECAUSE THE DATA IS PUBLIC ─────────────────────────
 * `GET /public/quiz-games/{game}/results` needs no session, so there is nothing
 * per-reader to render on the client and no reason to ship a query, a store or
 * a loading state to a browser. The page is HTML by the time it arrives, which
 * is also what makes it fast on the phone-on-mobile-data where a pasted link is
 * usually opened. `generateMetadata` and the body read through ONE React-cached
 * loader, so a render costs a single upstream request.
 *
 * ── NOINDEX, BUT UNFURLABLE ────────────────────────────────────────────────
 * The uuid is the only key, so this must never end up in a search index — hence
 * `robots: { index: false }`. Social unfurlers do not consult that tag, and
 * `/quiz-results` is deliberately NOT added to `robots.txt` (a Disallow there
 * would stop the very crawlers that draw the preview card), so a pasted link
 * still becomes a real card while the page stays out of search.
 *
 * ── ONE REFUSAL STATE, BECAUSE THERE IS ONLY ONE ANSWER ────────────────────
 * A lobby, a game still running, a cancelled game and a uuid that never existed
 * all answer `404`, and they are indistinguishable on purpose — the endpoint
 * will not confirm which uuids are real. So this page does not guess: it says
 * the one true thing ("there is no finished game at this link") and leaves it
 * there. `notFound()` is not used, because it would hand a public share link to
 * the app's own signed-in 404 shell, which speaks in a voice this reader has no
 * context for.
 */

interface PageProps {
  params: Promise<{ gameUuid: string }>;
}

/** ONE upstream read per request, shared by `generateMetadata`, the body and
 *  nothing else. The fetch beneath it is separately cached (see
 *  {@link fetchPublicQuizResults}). */
const loadResults = cache(
  async (gameUuid: string): Promise<PublicQuizGameResults | null> =>
    fetchPublicQuizResults(gameUuid),
);

/** `1,768` — the same grouping the in-app scoreboards use. */
function formatScore(score: number): string {
  return score.toLocaleString('en-NG');
}

/** `4 August 2026`, or nothing at all when the stamp is unreadable. An absolute
 *  date, never a relative one: this page is permanent and is read months later,
 *  where "3 days ago" would be a lie the moment it was cached. */
function formatFinishedAt(iso: string): string {
  const parsed = parseISO(iso);
  return isValid(parsed) ? format(parsed, 'd MMMM yyyy') : '';
}

/** "4 questions · 12 players · 4 August 2026", minus whatever is unreadable. */
function summaryLine(results: PublicQuizGameResults): string {
  const day = formatFinishedAt(results.finished_at);
  return [
    `${results.question_count} ${results.question_count === 1 ? 'question' : 'questions'}`,
    `${results.player_count} ${results.player_count === 1 ? 'player' : 'players'}`,
    day,
  ]
    .filter(Boolean)
    .join(' · ');
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { gameUuid } = await params;
  const results = await loadResults(gameUuid);
  const appUrl = getAppUrl().replace(/\/$/, '');
  const canonical = `${appUrl}${publicQuizResultsPath(gameUuid)}`;

  if (!results) {
    // An honest card for a link that leads nowhere — never a broken preview,
    // and never a hint about which of the four refusals it was.
    return {
      title: 'Quiz results',
      description: 'This result link has expired or never pointed anywhere.',
      robots: { index: false, follow: false },
    };
  }

  const winner = results.podium[0];
  const title = `${results.quiz_title} — final scores`;
  const description = winner
    ? `${winner.name} took it with ${formatScore(results.top_score)}. ${summaryLine(results)}.`
    : `${summaryLine(results)}.`;
  const ogImageUrl = `${appUrl}/api/og/quiz-results/${encodeURIComponent(gameUuid)}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: SEO.siteName,
      type: 'website',
      locale: SEO.locale,
      images: [
        {
          url: ogImageUrl,
          width: SEO.ogImageWidth,
          height: SEO.ogImageHeight,
          alt: `${results.quiz_title} — final scores`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      site: SEO.twitterHandle,
      images: [ogImageUrl],
    },
    // The link IS the secret; a search index would be a second, unwanted key.
    robots: { index: false, follow: false },
  };
}

export default async function PublicQuizResultsPage({ params }: PageProps) {
  const { gameUuid } = await params;
  const results = await loadResults(gameUuid);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        {results ? <ResultCard results={results} /> : <NoResultCard />}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          <Link
            href="/"
            className="underline-offset-4 transition-colors duration-150 hover:text-foreground hover:underline motion-reduce:transition-none"
          >
            Played on Lawexa
          </Link>
        </p>
      </div>
    </main>
  );
}

/**
 * THE CARD. One hero and two runners-up, not three equal columns.
 *
 * A shared scoreboard has exactly one thing worth seeing from across a room —
 * who won, and by how much — and everything else is caption. So the top score
 * is the largest object on the page, the winner's face sits above it, and
 * second and third are two quiet rows underneath rather than a chart that makes
 * the reader compare bar heights. It is also the only shape that survives the
 * real data: a two-player game loses a row instead of looking broken, and a
 * one-player game is just the hero.
 */
function ResultCard({ results }: { results: PublicQuizGameResults }) {
  const [winner, ...runners] = results.podium;

  return (
    <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        Final scores
      </p>
      <h1 className="mt-2 font-fraunces text-2xl leading-tight font-semibold text-balance text-foreground sm:text-3xl">
        {results.quiz_title}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {summaryLine(results)}
      </p>

      {winner ? (
        <>
          <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-6 text-center">
            <PodiumFace row={winner} className="size-16" />
            <p className="mt-1 max-w-full truncate text-sm font-medium text-foreground">
              {winner.name}
            </p>
            <p className="text-4xl leading-none font-semibold tabular-nums text-primary">
              {formatScore(winner.score)}
            </p>
            <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Winner
            </p>
          </div>

          {runners.length > 0 && (
            <ol className="mt-3 flex flex-col gap-1.5">
              {runners.map((row) => (
                <li
                  key={`${row.rank}-${row.name}`}
                  className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2"
                >
                  <span className="w-4 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {row.rank}
                  </span>
                  <PodiumFace row={row} className="size-7" />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {row.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatScore(row.score)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        // The endpoint publishes a podium and a top score; a finished game with
        // an empty one is the only combination left, and it is still a real
        // answer rather than a failure.
        <p className="mt-6 rounded-2xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          This one finished with nobody on the board.
        </p>
      )}
    </section>
  );
}

/**
 * A podium face. The public row is NOT a user object — it has a name, a picture
 * and a score, and no uuid — so it is never linked, never matched to an account
 * and never handed to anything that expects a person.
 */
function PodiumFace({
  row,
  className,
}: {
  row: PublicQuizPodiumRow;
  className?: string;
}) {
  return (
    <Avatar className={cn('shrink-0', className)}>
      {row.avatar_url ? <AvatarImage src={row.avatar_url} alt="" /> : null}
      <AvatarFallback>{getInitials(row.name)}</AvatarFallback>
    </Avatar>
  );
}

/**
 * The ONE refusal. Four different truths arrive here as one indistinguishable
 * `404` — not started, still running, cancelled, or never existed — so this
 * says only what is certainly true of all four and offers no diagnosis it does
 * not have.
 */
function NoResultCard() {
  return (
    <section className="rounded-3xl border bg-card p-8 text-center shadow-sm">
      <span
        aria-hidden
        className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <Trophy className="size-6" />
      </span>
      <h1 className="mt-4 font-fraunces text-xl font-semibold text-foreground">
        Nothing to show here
      </h1>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Results are published when a quiz runs all the way to the end. This link
        does not point at one — it may have been cancelled, it may still be
        playing, or the link may simply be wrong.
      </p>
    </section>
  );
}
