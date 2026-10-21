import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizAttemptQuestion } from '@/types/channel-quiz';
import { questionVerdict } from './model';

/* The solo results (/quiz/attempts/{uuid}/results, 21 October 2026): the
 * server's score, points and speed, every question revealed, Retake and
 * Share. Pure rules first, then the wiring, pinned by source. */

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

test('the headline and the cards show the right, the wrong, the skipped, the points and the speed', () => {
  const summary = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptSummary.tsx');
  assert.match(summary, /label=\{`\$\{pointsLabel\(score\.points\)\} of \$\{pointsLabel\(score\.maxPoints\)\} pts`\}/);
  assert.match(summary, /\{speed && <SummaryChip icon=\{Clock\} tone="quiet" label=\{speed\} \/>\}/);
  assert.match(summary, /label=\{`\$\{unanswered\} unanswered`\}/);
  assert.match(summary, /path=\{quizFrontHref\(attempt\.quiz\.uuid\)\}/);
  const card = read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptQuestionCard.tsx');
  assert.match(card, /const verdict = questionVerdict\(question\);/);
  assert.match(card, /formatResponseTime\(responseMs\)/);
  assert.match(card, /\{points > 0 \? `\+\$\{pointsLabel\(points\)\}` : '0'\} pts/);
  assert.match(card, /'Correct' : verdict === 'incorrect' \? 'Incorrect' : 'Unanswered'/);
});

test('the ring and the chips are shared with the practice review', () => {
  const practice = read('v2', 'features', 'quiz', 'results', 'ResultsSummary.tsx');
  assert.match(practice, /import \{ ScoreRing \} from '\.\/ScoreRing';/);
  assert.match(practice, /import \{ SummaryChip \} from '\.\/SummaryChip';/);
  assert.doesNotMatch(practice, /function ScoreRing|function Chip\(/);
  assert.match(read('v2', 'features', 'quiz', 'solo', 'results', 'AttemptSummary.tsx'), /from '\.\.\/\.\.\/results\/ScoreRing'/);
  const ring = read('v2', 'features', 'quiz', 'results', 'ScoreRing.tsx');
  assert.match(ring, /aria-label=\{empty \? emptyLabel : `Score: \$\{rounded\} percent`\}/);
});

test('the routes are private, and the segment boundary draws the results shape for the play → results hand-off', () => {
  const base = ['app', 'v2', 'quiz', '(solo)', 'attempts', '[attemptUuid]'];
  assert.match(read(...base, 'results', 'page.tsx'), /robots: \{ index: false, follow: false \}/);
  assert.match(read(...base, 'results', 'loading.tsx'), /return <AttemptResultsFallback \/>;/);
  assert.match(read(...base, 'loading.tsx'), /return <AttemptResultsFallback \/>;/);
  // The player draws the same shape while it sends a finished attempt on.
  assert.match(read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlayerScreen.tsx'), /if \(finished\) \{\s*return \(\s*<div className=\{LIST_COLUMN\}>\s*<AttemptResultsSkeleton \/>/);
});
