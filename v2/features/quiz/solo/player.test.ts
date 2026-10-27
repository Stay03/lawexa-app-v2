import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizAttempt, QuizAttemptQuestion } from '@/types/channel-quiz';
import {
  answerTimedOut,
  attemptPoints,
  endAttemptCopy,
  END_MODE_ADVANCE_MS,
  nextUnanswered,
  optionTileState,
  playStep,
  unansweredCount,
} from './model';

/* The solo player (/quiz/attempts/{uuid}, 21 October 2026): the server holds
 * the answers, the screen holds the place, the app runs the clock. Pure rules
 * first, then the wiring, pinned by source. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

const question = (over: Partial<QuizAttemptQuestion> = {}): QuizAttemptQuestion => ({
  uuid: 'q1',
  type: 'multiple_choice',
  question: 'Which case?',
  time_limit_seconds: 30,
  position: 0,
  options: [
    { id: 3, content: 'Carlill', position: 0 },
    { id: 4, content: 'Donoghue', position: 1 },
    { id: 5, content: 'Hadley', position: 2 },
  ],
  answered: false,
  ...over,
});

const attempt = (questions: QuizAttemptQuestion[]): QuizAttempt => ({
  uuid: 'a1',
  quiz: { uuid: 'z1', title: 'Contract Drill', description: null, creator: null },
  reveal_mode: 'each',
  question_count: questions.length,
  answered_count: questions.filter((entry) => entry.answered).length,
  started_at: '2026-10-21T15:44:16+00:00',
  finished_at: null,
  questions,
});

/* ── No second try (Techlead, 27 October 2026) ───────────────────────────── */

test('a reload never reopens a question that ran out of time before a later answer', () => {
  const at = (position: number, answered: boolean) => question({ uuid: `q${position}`, position, answered });
  // Q2 timed out, Q3 was answered, then the page reloaded: on to Q4, not back to Q2.
  assert.equal(nextUnanswered(attempt([at(0, true), at(1, false), at(2, true), at(3, false)])), 3);
  // Nothing answered yet: the first question.
  assert.equal(nextUnanswered(attempt([at(0, false), at(1, false)])), 0);
  // Everything after the furthest answer is done: only Finish is left, and the
  // passed-over question is one of the unanswered ones it scores as wrong.
  const done = attempt([at(0, true), at(1, false), at(2, true)]);
  assert.equal(nextUnanswered(done), null);
  assert.equal(unansweredCount(done), 1);
  const play = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  assert.match(play, /title=\{unanswered > 0 \? 'Nothing left to answer' : 'Every question answered'\}/);
  assert.match(play, /ran out of time and count as wrong\./);
});

test("the server's \"time_ran_out\" refusal is a question lost to the clock, and the quiz moves on", () => {
  assert.equal(answerTimedOut(409, { reason: 'time_ran_out' }), true);
  // Any other 409, or the reason on another status, is not this.
  assert.equal(answerTimedOut(409, { reason: 'already_answered' }), false);
  assert.equal(answerTimedOut(409, null), false);
  assert.equal(answerTimedOut(422, { reason: 'time_ran_out' }), false);
  const play = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  assert.match(
    play,
    /if \(answerTimedOut\(status, errors\)\) \{\s*setNote\(null\);\s*setPlace\(\(current\) => \(current\.cursor === cursor \? \{ \.\.\.current, timedOut: true \} : current\)\);\s*return;\s*\}/,
  );
});

/* ── The steps ────────────────────────────────────────────────────────────── */

test("the server's word comes first: an answered question is revealed or answered, never timed out", () => {
  const open = question();
  assert.equal(playStep(open, 'each', false, false), 'open');
  assert.equal(playStep(open, 'each', true, false), 'sending');
  assert.equal(playStep(open, 'each', false, true), 'timed-out');
  // A send in flight keeps its chance even once the clock ran out.
  assert.equal(playStep(open, 'each', true, true), 'sending');
  const revealed = question({ answered: true, your_option_id: 3, correct_option_id: 3, is_correct: true, points: 900 });
  assert.equal(playStep(revealed, 'each', false, true), 'revealed');
  // An `end` attempt learns nothing until the results; so does an `each`
  // body that somehow lacks its verdict.
  const locked = question({ answered: true, your_option_id: 4 });
  assert.equal(playStep(locked, 'end', false, false), 'answered');
  assert.equal(playStep(locked, 'each', false, false), 'answered');
});

test('a tile paints from the server at the reveal and from the tap only while it is in flight', () => {
  const open = question();
  assert.equal(optionTileState(3, open, 'open', null), 'idle');
  assert.equal(optionTileState(3, open, 'sending', 3), 'picked');
  assert.equal(optionTileState(4, open, 'sending', 3), 'locked-other');
  assert.equal(optionTileState(3, open, 'timed-out', null), 'locked-other');
  const wrong = question({ answered: true, your_option_id: 4, correct_option_id: 3, is_correct: false, points: 0 });
  assert.equal(optionTileState(3, wrong, 'revealed', null), 'correct');
  assert.equal(optionTileState(4, wrong, 'revealed', null), 'wrong-pick');
  assert.equal(optionTileState(5, wrong, 'revealed', null), 'missed');
  // A stale local tap never colours a reveal: the server's pick does.
  assert.equal(optionTileState(5, wrong, 'revealed', 5), 'missed');
  const locked = question({ answered: true, your_option_id: 4 });
  assert.equal(optionTileState(4, locked, 'answered', null), 'picked');
  assert.equal(optionTileState(3, locked, 'answered', null), 'locked-other');
});

test('points so far are the sum of the receipts, and Finish knows how many are unanswered', () => {
  const rows = [
    question({ uuid: 'q1', position: 0, answered: true, points: 875 }),
    question({ uuid: 'q2', position: 1, answered: true, points: 0 }),
    question({ uuid: 'q3', position: 2 }),
    question({ uuid: 'q4', position: 3, answered: true, points: 500 }),
  ];
  assert.equal(attemptPoints(attempt(rows)), 1375);
  assert.equal(unansweredCount(attempt(rows)), 1);
  assert.equal(attemptPoints(attempt([question()])), 0);
  assert.ok(END_MODE_ADVANCE_MS > 0 && END_MODE_ADVANCE_MS < 1000);
});

/* ── The wiring ───────────────────────────────────────────────────────────── */

test('the clock is read in handlers and initialisers, never in render, and response_ms is monotonic', () => {
  const play = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  // The place opens lazily with both clocks, and moves on with both again.
  assert.match(play, /useState<PlayPlace>\(\(\) => \(\{\s*cursor: nextUnanswered\(attempt\) \?\? questions\.length,\s*openedAtMs: Date\.now\(\),\s*openedPerfMs: performance\.now\(\),\s*timedOut: false,\s*\}\)\)/);
  assert.match(play, /response_ms: responseMsFor\(place\.openedPerfMs, performance\.now\(\)\),/);
  // Every `Date.now()` sits inside an initialiser, a callback or an effect.
  const renderBody = play.replace(/useState<PlayPlace>\(\(\) => \([\s\S]*?\)\)/, '').replace(/useCallback\(\(\) => \{[\s\S]*?\}, \[cursor\]\)/, '').replace(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g, '');
  assert.doesNotMatch(renderBody, /Date\.now\(\)/);
  // Time's up is a timeout armed while the question is open, guarded by cursor.
  assert.match(play, /if \(!question \|\| step !== 'open'\) return;\s*const remaining = questionDeadlineMs\(place\.openedAtMs, question\.time_limit_seconds\) - Date\.now\(\);/);
  assert.match(play, /current\.cursor === cursor \? \{ \.\.\.current, timedOut: true \} : current/);
  // The timer leaf draws from the game clock and says Time's up at zero.
  const timer = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptTimer.tsx');
  assert.match(timer, /useServerCountdown\(/);
  assert.match(timer, /Time&rsquo;s up/);
});

test('each holds its verdict on the tiles, then moves on by itself (a tap sooner); end holds a beat, with Finish last', () => {
  const play = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  assert.match(play, /if \(step !== 'answered' \|\| isLast\) return;\s*const id = window\.setTimeout\(advance, END_MODE_ADVANCE_MS\);/);
  // Arthur, 22 October 2026: "no need for continue button as it should then
  // be a tap to answer". The hold, then the next question or the results.
  assert.match(play, /const holding =\s*attempt\.reveal_mode === 'each' && \(step === 'revealed' \|\| step === 'timed-out'\);/);
  assert.match(play, /const moveOn = \(\) => \{\s*if \(finish\.isPending\) return;\s*if \(isLast\) finishNow\(\);\s*else advance\(\);\s*\};/);
  assert.match(play, /const id = window\.setTimeout\(\(\) => moveOnAfterHold\(\), REVEAL_HOLD_MS\);/);
  // Nothing holds the hold: no report flag while playing (Arthur, 27 October 2026).
  assert.match(play, /onClick=\{holding \? moveOn : undefined\}/);
  assert.match(play, /if \(event\.key !== 'Enter' && event\.key !== ' '\) return;/);
  assert.match(play, /onSuccess: \(\) => router\.replace\(attemptResultsHref\(attempt\.uuid\)\),/);
  // The sheet is the `end` attempt's alone: its last answer and a lost clock;
  // unanswered questions are named before they are scored.
  assert.match(play, /const sheet =\s*attempt\.reveal_mode === 'end' && \(\(step === 'answered' && isLast\) \|\| step === 'timed-out'\);/);
  assert.match(play, /onContinue=\{isLast \? finishNow : advance\}/);
  assert.match(play, /\{isLast \? 'See results' : 'Continue'\}/);
  assert.match(play, /\{unanswered\} unanswered: /);
  // No verdict sheet in either mode (3e9c4a28): B1's celebration rides the
  // tiles and the foot instead (below).
  assert.doesNotMatch(play, /RevealSheet|TickBurst|was the\s*answer/);
  // The tiles are B1's, in the channel game's states; the digits are scoped
  // to the group.
  assert.match(play, /<AttemptOptionTile\s*key=\{option\.id\}/);
  assert.match(play, /state=\{optionTileState\(option\.id, question, step, pendingPick\)\}/);
  assert.match(play, /role="group"\s*aria-labelledby=\{headingId\}\s*onKeyDown=\{handleKeyDown\}/);
  assert.match(play, /if \(previous !== null && previous !== cursor\) groupRef\.current\?\.focus\(\);/);
  // No toasts; a refusal is the one line in the foot or on the sheet.
  assert.doesNotMatch(play, /from 'sonner'/);
  assert.match(play, /setNote\(answerRefusalCopy\(status, message\)\);/);
});

test('the question screen is drawn in B1: segments and the thin clock over the question, raised tiles that carry the verdict', () => {
  const play = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  assert.match(play, /import '\.\.\/solo-quiz\.css';/);
  // One segment per question, then the rail: live while open, frozen with
  // the answer's time at the reveal, empty on a lost clock.
  assert.match(play, /<ProgressSegments className="mt-3" segments=\{segments\} current=\{cursor\} total=\{total\} \/>/);
  assert.match(play, /fraction=\{1 - \(question\.response_ms \?\? 0\) \/ \(question\.time_limit_seconds \* 1000\)\}\s*label=\{secondsLabel\(question\.response_ms \?\? 0\)\}/);
  assert.match(play, /<FrozenRail fraction=\{0\} label="Time's up" \/>/);
  // The passage where there is one, then the question; no kicker over it.
  assert.doesNotMatch(play, /questionKicker|Pick one|True or false/);
  assert.match(play, /scenario=\{scenarioFor\(attempt, question\)\}/);
  assert.match(play, /<p className="whitespace-pre-line">\{scenario\.passage\}<\/p>/);
  // True or false is two tall tiles; everything else is a card.
  assert.match(play, /look=\{question\.type === 'true_false' \? \(index === 0 \? 'true' : 'false'\) : 'card'\}/);
  // The verdict is the tiles': the tapped one shows its points, and during the
  // hold the tiles are passive, so a tap reaches the screen's "move on".
  assert.match(play, /badge=\{\s*step === 'revealed' && option\.id === question\.your_option_id \? \(\s*<>\s*\+<CountUp value=\{question\.points \?\? 0\} \/>\s*<\/>\s*\) : null\s*\}/);
  assert.match(play, /disabled=\{step === 'sending' \|\| step === 'answered'\}/);
  // The `end` sheet, quiet: no verdict before the results.
  assert.match(play, /className="v2-solo-rise sticky bottom-0 z-10 -mx-4 -mb-6 rounded-t-3xl border-t-2 border-border bg-card/);

  const tile = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptOptionTile.tsx');
  // Never colour alone: the verdict is a sentence too, and the digit is for a pointer.
  assert.match(tile, /\{REVEAL_LABEL\[state\] && <span className="sr-only">\. \{REVEAL_LABEL\[state\]\}<\/span>\}/);
  assert.match(tile, /\[@media\(hover:hover\)_and_\(pointer:fine\)\]:inline-block/);
  assert.match(tile, /'v2-interactive v2-solo-lip relative flex w-full items-center gap-4 rounded-2xl border-2 text-left'/);
  // A passive tile (no pick, not locked) is not disabled, so its tap bubbles.
  assert.match(tile, /onClick=\{interactive \? onSelect : undefined\}\s*disabled=\{disabled === true\}\s*aria-disabled=\{interactive \? undefined : true\}/);
  assert.match(tile, /\{badge && \(/);

  /* B1's celebration without the sheet (Arthur's B1, 24 October 2026): on
   * the reader's own right pick the tick pops and bursts, the points count
   * up in the badge, and a run of two or more shows in the foot during the
   * hold. Reduced motion keeps the tick, the final number and the chip. */
  assert.match(play, /celebrate=\{\s*step === 'revealed' && option\.id === question\.your_option_id && question\.is_correct === true\s*\}/);
  assert.match(play, /const streak = step === 'revealed' && question\?\.is_correct === true \? streakEndingAt\(questions, cursor\) : 0;/);
  assert.match(play, /\) : step === 'revealed' \? \((?:\s*\/\/[^\n]*\n)+\s*streak >= 2 \? <StreakChip count=\{streak\} \/> : null\s*\) :/);
  // On a tall question the foot still shows (Tester, 24 October 2026): with
  // no sheet up it is sticky at the screen's foot, and the chip's ground is solid.
  assert.match(play, /sheet \? 'mt-auto pt-6' : 'sticky bottom-0 z-10 mt-auto pt-6 pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]'/);
  assert.match(read('v2', 'features', 'quiz', 'solo', 'ui.tsx'), /bg-\[color-mix\(in_oklch,var\(--primary\)_10%,var\(--background\)\)\]/);
  assert.match(tile, /celebrate &&\s*'v2-solo-pop shadow-\[0_0_0_6px_color-mix\(in_oklch,var\(--solo-right\)_18%,transparent\)\]'/);
  assert.match(tile, /\{celebrate && <BurstDots className="top-\[9px\] left-\[9px\]" \/>\}/);
  const countUp = read('v2', 'features', 'quiz', 'solo', 'ui.tsx');
  assert.match(countUp, /const \[still\] = useState\(prefersReducedMotion\);/);
  assert.match(countUp, /return pointsLabel\(still \? value : shown\);/);
  assert.match(countUp, /setShown\(Math\.round\(value \* \(1 - \(1 - done\) \*\* 3\)\)\);/);
  const motionCss = read('v2', 'features', 'quiz', 'solo', 'solo-quiz.css');
  assert.match(motionCss, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.v2-solo-dot \{\s*opacity: 0;/);

  const timer = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptTimer.tsx');
  assert.match(timer, /\{clock\.seconds\} s/);
  assert.match(timer, /export function FrozenRail/);

  // The play column is a full-height flex column, so the sheet can stick to
  // the bottom; the B1 tokens ride it.
  const states = read('v2', 'features', 'quiz', 'solo', 'player', 'states.tsx');
  assert.match(states, /export const SOLO_PLAY_COLUMN = 'v2-solo mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 pb-6';/);
  assert.match(read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlayerScreen.tsx'), /<div className=\{SOLO_PLAY_COLUMN\}>\s*<AttemptPlayerSkeleton \/>/);

  // The kit: the raised button is the house Button underneath.
  const kit = read('v2', 'features', 'quiz', 'solo', 'ui.tsx');
  assert.match(kit, /import \{ Button \} from '@\/components\/ui\/button';/);
  assert.match(kit, /variant=\{tone === 'primary' \? 'default' : 'outline'\}/);
  assert.match(kit, /role="img"\s*aria-label=\{\s*current < total \? `Question \$\{current \+ 1\} of \$\{total\}` : `\$\{total\} of \$\{total\} answered`/);
});

test('the screen resumes from the read, sends a finished attempt to its results, and names the quiz as the way back', () => {
  const screen = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlayerScreen.tsx');
  assert.match(screen, /useQuery\(soloQuizQueries\.attempt\(attemptUuid, \{ viewerId \}\)\)/);
  assert.match(screen, /if \(finished\) router\.replace\(attemptResultsHref\(attemptUuid\)\);/);
  assert.match(screen, /back: quizUuid \? \{ href: quizFrontHref\(quizUuid\), label: 'Back to the quiz' \} : null,/);
  assert.match(screen, /title="We couldn't find this attempt"/);
  const page = read('app', 'v2', 'quiz', '(solo)', 'attempts', '[attemptUuid]', '(play)', 'page.tsx');
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(read('app', 'v2', 'quiz', '(solo)', 'attempts', '[attemptUuid]', '(play)', 'loading.tsx'), /return <AttemptPlayerFallback \/>;/);
});

/* Arthur, 24 October 2026: a way to end the quiz you started, then the
 * results for what was answered. */
test('End quiz asks first, then scores what was answered and goes to the results', () => {
  assert.equal(endAttemptCopy(4, 10), "You've answered 4 of 10. Your score counts those, and the 6 left count as wrong. You can take the quiz again any time.");
  assert.equal(endAttemptCopy(10, 10), "You've answered 10 of 10. Your score and every answer come next.");
  assert.equal(endAttemptCopy(0, 10), "You haven't answered any of the 10 questions yet, so your score will be 0. You can take the quiz again any time.");
  const play = readFileSync(join(process.cwd(), 'v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx'), 'utf8');
  // The button never moves the hold on: its tap stops at the button.
  assert.match(play, /onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*setEnding\(true\);\s*\}\}/);
  assert.match(play, /<EndAttemptDialog\s*open=\{ending\}\s*answered=\{attempt\.answered_count\}\s*total=\{total\}\s*ending=\{finish\.isPending\}\s*onCancel=\{\(\) => setEnding\(false\)\}\s*onConfirm=\{finishNow\}/);
  // The same finish as the last question's: scored, then the results.
  assert.match(play, /finish\.mutate\(undefined, \{\s*onSuccess: \(\) => router\.replace\(attemptResultsHref\(attempt\.uuid\)\),/);
  const dialog = readFileSync(join(process.cwd(), 'v2', 'features', 'quiz', 'solo', 'player', 'EndAttemptDialog.tsx'), 'utf8');
  // It stays open while it ends: the action's own close is held.
  assert.match(dialog, /onClick=\{\(event\) => \{\s*event\.preventDefault\(\);\s*onConfirm\(\);\s*\}\}/);
  assert.match(dialog, /<AlertDialogCancel disabled=\{ending\}>Keep playing<\/AlertDialogCancel>/);
});

/* Stay, 24 October 2026: "So many unnecessary text please remove them". */
test('the player says only what the screen does not already say', () => {
  const play = read('v2', 'features', 'quiz', 'solo', 'player', 'AttemptPlay.tsx');
  // No line before a tap on a phone; a computer names its keys, and that is all.
  assert.doesNotMatch(play, /Tap to answer|Click an answer|The first pick/);
  assert.match(play, /<p className="hidden \[@media\(hover:hover\)_and_\(pointer:fine\)\]:block">\s*Press <Key>1<\/Key> to <Key>\{optionCount\}<\/Key>\s*<\/p>/);
  // A question lost to the clock, in one short sentence.
  assert.match(play, /Out of time\. It counts as wrong\./);
  assert.doesNotMatch(play, /Nothing was recorded for this one/);
  // A reopened attempt with nothing left: the title (and, when a question ran
  // out of time, one line saying so) and See results.
  assert.match(play, /title=\{unanswered > 0 \? 'Nothing left to answer' : 'Every question answered'\}\s*description=\{/);
  assert.doesNotMatch(play, /Finish to see your score/);
  // Kept: the only sign an answer went in when the verdict waits for the end.
  assert.match(play, /Locked in/);
});
