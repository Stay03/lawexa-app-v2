import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizAttemptQuestion } from '@/types/channel-quiz';
import { questionVerdict } from './model';

/* The solo results (/quiz/attempts/{uuid}/results, 21 October 2026; design
 * B1 on 22 October): the points as the hero, one row of stats, the
 * comparison line, every question revealed behind a fold, Take it again
 * and Challenge a friend. Pure rules first, then the wiring, pinned by
 * source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

const question = (over: Partial<QuizAttemptQuestion>): QuizAttemptQuestion => ({
  uuid: 'q1',
  type: 'true_false',
  question: 'Land includes things attached to it.',
  time_limit_seconds: 20,
  position: 0,
  options: [
    { id: 1, content: 'True', position: 0 },
    { id: 2, content: 'False', position: 1 },
  ],
  answered: true,
  ...over,
});

test('a skipped question is its own verdict, not a red Incorrect', () => {
  assert.equal(questionVerdict(question({ your_option_id: 1, correct_option_id: 1, is_correct: true, points: 875 })), 'correct');
  assert.equal(questionVerdict(question({ your_option_id: 2, correct_option_id: 1, is_correct: false, points: 0 })), 'incorrect');
  // The finished body's own shape for a skipped question (key 3a).
  assert.equal(questionVerdict(question({ answered: false, your_option_id: null, correct_option_id: 1, is_correct: false, points: 0, response_ms: null })), 'unanswered');
});

test('the review reads the score from the server, sends an unfinished attempt back to play, and names the quiz as the way back', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx');
  assert.match(screen, /const score = attempt \? attemptScore\(attempt\) : null;/);
  assert.match(screen, /if \(unfinished\) router\.replace\(attemptHref\(attemptUuid\)\);/);
  assert.match(screen, /title="Couldn't read the score"/);
  assert.match(screen, /back: quizUuid \? \{ href: quizFrontHref\(quizUuid\), label: 'Back to the quiz' \} : null,/);
  // Retake is a fresh attempt with the same reveal choice, into the player.
  assert.match(screen, /startAttempt\.mutate\(attempt\.reveal_mode, \{\s*onSuccess: \(response\) => router\.push\(attemptHref\(response\.data\.uuid\)\),/);
  // Share only where a link can open the quiz, read from its detail.
  assert.match(screen, /const shareable = visibility === 'link' \|\| visibility === 'public';/);
  assert.doesNotMatch(screen, /from 'sonner'/);
});

test('the headline leads with the greeting and the points, then one row of three stats and the comparison line', () => {
  const summary = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptSummary.tsx');
  assert.match(summary, /\{greeting\(runTone\(score\), viewerName\)\}/);
  assert.match(summary, /\{pointsLabel\(score\.points\)\}/);
  assert.match(summary, /<Stat value=\{`\$\{highlights\.correct\}\/\$\{highlights\.total\}`\} label="right" \/>/);
  assert.match(summary, /<Stat value=\{String\(highlights\.streak\)\} label="in a row" \/>/);
  assert.match(summary, /value=\{highlights\.fastestMs === null \? 'None' : secondsLabel\(highlights\.fastestMs\)\}\s*label="fastest"/);
  assert.match(summary, /const line = comparisonLine\(attempt\.comparison, score\.points\);/);
  assert.match(summary, /\{line && <p className="mt-4 text-sm text-muted-foreground">\{line\}<\/p>\}/);
  // No per-answer average, no chips, no ring: the points are the story.
  assert.doesNotMatch(summary, /ScoreRing|SummaryChip|speedLabel|avgResponseMs|SPEED_SCORING_NOTE/);
  assert.match(summary, /divide-x divide-border/);
  // B1 motion note 6: the hero counts up over 800 ms, with the final number
  // laid out under it so the width holds, and read out once, final.
  assert.match(summary, /<span aria-hidden className="relative inline-block">\s*<span className="invisible">\{pointsLabel\(score\.points\)\}<\/span>\s*<span className="absolute inset-0 flex justify-center whitespace-nowrap">\s*<CountUp value=\{score\.points\} durationMs=\{800\} \/>/);
  assert.match(summary, /<span className="sr-only">\{pointsLabel\(score\.points\)\}<\/span>/);

  // One question's page: the server's verdict, its time and its points.
  const page = read('v2', 'features', 'quiz', 'solo', 'results', 'AnswersStepper.tsx');
  assert.match(page, /const verdict = questionVerdict\(question\);/);
  assert.match(page, /` · \$\{secondsLabel\(responseMs\)\}`/);
  assert.match(page, /\+\{pointsLabel\(points\)\}/);
  assert.match(page, /You didn&rsquo;t answer this one in time\./);
});

test('the answers open from one row, on their own page, and the two buttons sit at the bottom', () => {
  // One question per page (Stay and Arthur, 23 October 2026), not a fold of all of them.
  const fold = read('v2', 'features', 'quiz', 'solo', 'results', 'AnswersFold.tsx');
  assert.match(fold, /const subtitle = reviewSubtitle\(questions\.length, toReviewCount\(questions\)\);/);
  assert.match(fold, /See your answers/);
  assert.match(fold, /<Link\s+href=\{attemptAnswersHref\(attemptUuid\)\}/);
  assert.doesNotMatch(fold, /Collapsible|AttemptQuestionCard/);

  const actions = read('v2', 'features', 'quiz', 'solo', 'results', 'ResultsActions.tsx');
  assert.match(actions, /sticky bottom-0 z-10 -mx-4 -mb-16 mt-auto/);
  assert.match(actions, /Take it again/);
  assert.match(actions, /\{share\.copied \? 'Link copied' : 'Challenge a friend'\}/);
  // Other Quizzes: the third full-size button, to Explore (Arthur, 28 October 2026: "do B").
  assert.match(actions, /<RaisedButton tone="quiet" className="min-w-fit flex-1 basis-40 whitespace-nowrap" asChild>\s*<Link href=\{EXPLORE_HREF\}>\s*<Compass aria-hidden className="size-4" \/>\s*Other Quizzes\s*<\/Link>/);
  assert.equal((actions.match(/<RaisedButton/g) ?? []).length, 3);
  // The podium moment counts only what the bar leaves uncovered as on screen.
  assert.match(actions, /<div data-results-bar="" className="sticky bottom-0/);
  const position = read('v2', 'features', 'quiz', 'solo', 'results', 'FinishPosition.tsx');
  assert.match(position, /const barTop = document\.querySelector<HTMLElement>\('\[data-results-bar\]'\)\?\.getBoundingClientRect\(\)\.top \?\? window\.innerHeight;/);
  assert.match(position, /const shown = Math\.min\(box\.bottom, window\.innerHeight, barTop\) - Math\.max\(box\.top, 0\);/);
  assert.match(position, /document\.addEventListener\('scroll', onMove, \{ capture: true, passive: true \}\);/);
  assert.match(position, /window\.addEventListener\('resize', onMove\);/);
  // And only once the bar has its final height (Challenge a friend waits on the quiz's visibility).
  assert.match(position, /barSettled=\{publicQuiz !== null\}/);
  assert.match(position, /if \(phase !== 'waiting' \|\| !barSettled\) return;/);

  const screen = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptResultsScreen.tsx');
  assert.match(screen, /import '\.\.\/solo-quiz\.css';/);
  assert.match(screen, /const \{ userId: viewerId, name: viewerName \} = useV2Session\(\);/);
  assert.match(screen, /const highlights = attemptHighlights\(score, questions\);/);
  assert.match(screen, /challenge=\{challengeText\(viewerName, score\.points, attempt\.quiz\.title, highlights\)\}/);
  assert.match(screen, /<AnswersFold attemptUuid=\{attempt\.uuid\} questions=\{questions\} \/>/);
  // The results column is a full-height flex column, so the row can sit on
  // the bottom edge; the B1 tokens ride it.
  const states = read('v2', 'features', 'quiz', 'solo', 'results', 'states.tsx');
  assert.match(states, /export const RESULTS_COLUMN =\s*'v2-solo mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-16 pt-5 sm:pt-6';/);
  assert.match(screen, /<div className=\{RESULTS_COLUMN\}>\s*<AttemptSummary/);
});

test('the ring and the chips stay with the practice review; the solo results no longer draw them', () => {
  const practice = read('v2', 'features', 'quiz', 'results', 'ResultsSummary.tsx');
  assert.match(practice, /import \{ ScoreRing \} from '\.\/ScoreRing';/);
  assert.match(practice, /import \{ SummaryChip \} from '\.\/SummaryChip';/);
  assert.doesNotMatch(practice, /function ScoreRing|function Chip\(/);
  assert.doesNotMatch(read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptSummary.tsx'), /ScoreRing|SummaryChip/);
  const ring = read('v2', 'features', 'quiz', 'results', 'ScoreRing.tsx');
  assert.match(ring, /aria-label=\{empty \? emptyLabel : `Score: \$\{rounded\} percent`\}/);
});

test('the routes are private, and the segment boundary draws the results shape for the play → results hand-off', () => {
  const base = ['app', 'v2', 'quiz', '(solo)', 'attempts', '[attemptUuid]'];
  assert.match(read(...base, 'results', 'page.tsx'), /robots: \{ index: false, follow: false \}/);
  assert.match(read(...base, 'results', 'loading.tsx'), /return <AttemptResultsFallback \/>;/);
  assert.match(read(...base, 'loading.tsx'), /return <AttemptResultsFallback \/>;/);
  // The player draws the same shape while it sends a finished attempt on.
  assert.match(read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlayerScreen.tsx'), /if \(finished\) \{\s*return \(\s*<div className=\{RESULTS_COLUMN\}>\s*<AttemptResultsSkeleton \/>/);
});
