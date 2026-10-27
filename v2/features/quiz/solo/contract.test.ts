import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* The solo quiz contract (backend branch quiz-part1-publish-and-solo, tip
 * 45a8f711; bodies in ~/.lawexa/tools/frontend/contracts/quiz-45a8f711.json).
 * Pinned by source: the client's paths and the types' vocabulary must say what
 * the server says. */

const read = (...parts: string[]) =>
  readFileSync(join(process.cwd(), ...parts), 'utf8');

test('the client reaches every solo route at its measured address', () => {
  const api = read('lib', 'api', 'channel-quiz.ts');
  // The two quiz-home lists carry their filter choices beside the page.
  assert.match(api, /apiClient\.get<QuizHomeListResponse>\(\s*'\/channel-quizzes\/explore'/);
  assert.match(api, /apiClient\.get<QuizHomeListResponse>\(\s*'\/channel-quizzes\/mine'/);
  assert.match(api, /`\/channel-quizzes\/\$\{quizUuid\}\/leaderboard`,\s*\{ params: \{ limit \} \},/);
  assert.match(api, /`\/channel-quizzes\/\$\{quizUuid\}\/preview`/);
  assert.match(api, /apiClient\.post<QuizAttemptResponse>\(\s*`\/channel-quizzes\/\$\{quizUuid\}\/attempts`/);
  assert.match(api, /apiClient\.get<QuizAttemptResponse>\(\s*`\/channel-quiz-attempts\/\$\{attemptUuid\}`/);
  assert.match(api, /`\/channel-quiz-attempts\/\$\{attemptUuid\}\/answers`/);
  assert.match(api, /`\/channel-quiz-attempts\/\$\{attemptUuid\}\/finish`/);
  // The explore page size follows the server default; the ceiling is 50.
  assert.match(api, /'\/channel-quizzes\/explore',[\s\S]*?per_page: params\.per_page \?\? 15/);
});

test('the types carry the four visibilities, the two reveal modes and the attempt fields', () => {
  const types = read('types', 'channel-quiz.ts');
  assert.match(types, /export type ChannelQuizVisibility = 'shared' \| 'private' \| 'link' \| 'public';/);
  assert.match(types, /export type QuizRevealMode = 'each' \| 'end';/);
  // The score fields are optional: they exist only once `finished_at` is set.
  const attempt = types.slice(types.indexOf('export interface QuizAttempt {'));
  for (const field of ['correct_count?: number', 'score_percent?: number', 'points?: number', 'max_points?: number', 'avg_response_ms?: number | null', 'finished_at: string | null', 'reveal_mode: QuizRevealMode']) {
    assert.ok(attempt.includes(field), field);
  }
  // A quiz's author is the measured three fields, never a SlimUser with a username.
  // The verified tick on a list card is the one field added (quiz list, part 5).
  assert.match(types, /export type QuizAuthor = Pick<SlimUser, 'uuid' \| 'name' \| 'avatar_url'> & \{\s*\/\*\*[\s\S]*?\*\/\s*is_verified_author\?: boolean;\s*\};/);
  assert.match(types, /creator: QuizAuthor \| null;/);
  // The answer body is the app's own clock reading, and the receipt's verdict is optional.
  assert.match(types, /export interface SubmitQuizAttemptAnswerPayload \{\s*question_uuid: string;\s*option_id: number;\s*response_ms: number;\s*\}/);
  assert.match(types, /export interface QuizAttemptAnswerReceipt \{\s*answered_count: number;\s*question_count: number;\s*is_correct\?: boolean;/);
  // Scenarios are typed on the wire shapes, with the create body's index.
  assert.match(types, /scenarios\?: QuizScenario\[\];/);
  assert.match(types, /scenario_index\?: number;/);
  assert.match(types, /visibility\?: ChannelQuizVisibility;\s*settings\?: Partial<ChannelQuizSettings>;\s*\/\*\*[^\n]*\*\/\s*year\?: number \| null;\s*level\?: string \| null;\s*topic\?: string \| null;\s*questions: QuizQuestionInput\[\];\s*scenarios\?: QuizScenarioInput\[\];/);
});
