import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CAMPUS_NAMES, PERSONAS } from '@/lib/wrapped/copy';
import {
  CAPTION_SUB_WIDTH,
  SHARE_LAYOUT,
  captionSubFit,
  captionSubRoom,
  personaBanner,
  posterLine,
  wrappedPoster,
} from '@/lib/wrapped/share-image';
import type { QuizGameResults, QuizRankingRow } from '@/types/channel-quiz';
import type { WrappedRecord } from '@/lib/wrapped/types';
import { LIVE_BOARD_RULES_NOTE, liveGameBoard, liveRowNote } from './live-board';
import {
  cardName,
  pointsText,
  resultBanner,
  resultCardCopy,
  resultFrame,
  resultPoster,
  type ResultCardInput,
} from './result-card';

/* The live quiz's final scores and each player's card (Arthur, f730f71c, 11
 * November 2026: the quiz's own leaderboard "that comes with its animation",
 * and a card "just like we did for the Wrapped"). TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const quiz = (file: string) => read('v2', 'features', 'channels', 'quiz', file);

const INPUT: ResultCardInput = {
  playerName: 'Ada Obi',
  avatarUrl: null,
  institution: 'Nigerian Law School – Lagos Campus',
  rank: 2,
  score: 18400,
  correctCount: 8,
  answerableCount: 10,
  quizTitle: 'Torts 101',
  spaceName: 'LASU LSS',
  playerCount: 34,
  podium: [],
};

// Unbounded 900 is wide: about 0.82 of the size per letter, a little more than the real face measures.
const unbounded = (text: string, size: number) => text.length * size * 0.82;

test('the card is Wrapped’s poster with the player’s finish on it', () => {
  const poster = resultPoster(INPUT);
  assert.equal(poster.kicker, 'LIVE QUIZ · LASU LSS');
  assert.equal(poster.line, 'Came 2nd in Torts 101');
  // First name and last initial, Wrapped's rule for a name on a public picture.
  // Where they study under the name, the campus alone as the podium shortens it; the Space is in the kicker.
  assert.deepEqual(poster.caption, { name: 'Ada O.', sub: 'Lagos Campus' });
  assert.equal(resultPoster({ ...INPUT, institution: 'University of Lagos' }).caption.sub, 'University of Lagos');
  assert.equal(poster.mark, '2nd');
  assert.equal(poster.banner, 'Made the Podium');
  // Points past Wrapped's 9,999+ cap are printed whole.
  assert.deepEqual(poster.stickers, [
    { value: '18,400', label: 'points' },
    { value: '2nd', label: 'of 34 players' },
    { value: '8/10', label: 'right answers' },
  ]);
  assert.deepEqual(poster.campaign, ['The Law.', 'The Bar.', 'The Bench.']);
  assert.equal(poster.link, 'PLAY LIVE QUIZZES · LAWEXA.COM');

  assert.equal(resultBanner(1), 'Quiz Champion');
  assert.equal(resultBanner(3), 'Made the Podium');
  assert.equal(resultBanner(7), 'Took the Challenge');
  assert.deepEqual([1, 2, 3, 9].map((rank) => resultFrame(rank).colour), ['gold', 'lilac', 'coral', 'lime']);
  assert.equal(cardName('Oluwaseyifunmi Adebanjo-Okonkwo'), 'Oluwaseyifunmi A.');
  assert.equal(cardName('Tobi'), 'Tobi');

  const bare = resultPoster({ ...INPUT, spaceName: null, institution: null, playerCount: 1, score: 1 });
  assert.equal(bare.kicker, 'LIVE QUIZ');
  assert.equal(bare.caption.sub, null);
  assert.deepEqual(bare.stickers.slice(0, 2), [
    { value: '1', label: 'point' },
    { value: '2nd', label: 'of 1 player' },
  ]);
});

test('the share words name the player as the card does', () => {
  const copy = resultCardCopy(INPUT);
  assert.equal(copy.headline, 'Ada O. came 2nd in Torts 101');
  assert.equal(copy.shareText, 'Ada O. came 2nd in Torts 101, 18,400 pts, LASU LSS. Live quiz on Lawexa.');
  assert.equal(copy.fileName, 'lawexa-quiz-2nd.png');
  assert.equal(pointsText(1), '1 pt');
});

test('a long quiz title fits the poster’s band in three lines at most, and every banner fits its sticker', () => {
  for (const title of [
    'Torts 101',
    'Constitutional Law Two: Fundamental Rights Enforcement and Judicial Review',
    'Land Law, Equity and Trusts: Week Six Revision on Registered Titles and Charges',
  ]) {
    const line = posterLine(`Came 2nd in ${title}`, unbounded);
    assert.ok(line.lines.length <= 3, title);
    for (const text of line.lines) assert.ok(unbounded(text, line.size) <= SHARE_LAYOUT.top.width + 1, `"${text}" fits`);
  }
  for (const rank of [1, 2, 9]) {
    const banner = personaBanner(resultBanner(rank), unbounded);
    assert.ok(banner.right <= 1080 - 48, resultBanner(rank));
  }
});

// Inter 500: about 0.56 of the size per letter and 0.28 per space, a little wider than the face measures.
const inter = (text: string, size: number) =>
  [...text].reduce((width, ch) => width + (ch === ' ' ? 0.28 : 0.56) * size, 0);

test('the polaroid’s second line stops short of the sticker: a size down, then "…"', () => {
  // Wrapped: the six shorter campuses keep the 30 px they always had beside every persona's sticker; Port
  // Harcourt (320 px in Inter at 30 px, measured) may step down so it no longer runs under a sticker.
  for (const { name } of Object.values(PERSONAS)) {
    const room = captionSubRoom(personaBanner(name, unbounded));
    assert.ok(room > 0 && room <= CAPTION_SUB_WIDTH, `${name}: ${room}`);
    for (const campus of Object.values(CAMPUS_NAMES)) {
      const line = `${campus} Campus`;
      const fit = captionSubFit(line, inter, room);
      if (campus !== 'Port Harcourt') assert.deepEqual(fit, { size: 30, text: line }, `${name} · ${campus}`);
      assert.ok(inter(fit.text, fit.size) <= room, `${name} · ${campus} fits`);
    }
  }
  // The live quiz's stickers: a long university steps down, and past 22 px ends with "…", clear of the sticker.
  for (const banner of ['Quiz Champion', 'Made the Podium', 'Took the Challenge']) {
    const room = captionSubRoom(personaBanner(banner, unbounded));
    const long = captionSubFit('Ahmadu Bello University, Zaria', inter, room);
    assert.ok(long.size >= 22 && inter(long.text, long.size) <= room, `${banner}: ${JSON.stringify(long)}`);
    const longer = captionSubFit('Ladoke Akintola University of Technology, Ogbomoso', inter, room);
    assert.ok(longer.text.endsWith('…') && inter(longer.text, 22) <= room, `${banner}: ${longer.text}`);
  }
  // Never squeezed by fillText's maxWidth again, and measured against the sticker where it is drawn.
  const poster = read('lib', 'wrapped', 'share-image.ts');
  assert.doesNotMatch(poster, /fillText\(content\.caption\.sub/);
  assert.match(poster, /captionSubFit\(content\.caption\.sub, measureBody, captionSubRoom\(banner\)\)/);
});

test('Wrapped draws the same poster it did, from its record', () => {
  const record = {
    vibe: { id: 1 },
    student: { first_name: 'Ada', last_initial: 'O', campus: null, photo_url: null },
    persona: { key: 'steady_learned_friend' },
    stickers: [{ key: 'days_active', value: 12 }],
    share_code: null,
  } as unknown as WrappedRecord;
  const poster = wrappedPoster(record);
  assert.equal(poster.kicker, 'MY POST-BAR FINALS VIBE:');
  assert.deepEqual(poster.caption, { name: 'Ada O.', sub: null });
  assert.equal(poster.link, 'GET YOURS · LAWEXA.COM/WRAPPED');
  const wrapped = read('lib', 'wrapped', 'share-image.ts');
  assert.match(wrapped, /export function drawShareCard\([^)]*\): void \{\s*drawPoster\(canvas, wrappedPoster\(record\), fonts, art\);\s*\}/);
});

test('the card is drawn and shared the way Wrapped’s is', () => {
  const card = quiz('ResultCardShare.tsx');
  assert.match(card, /loadImage\(wrappedArt\('frame', resultFrame\(input\.rank\)\.vibeId\)\)/);
  assert.match(card, /loadImage\(corsPhotoUrl\(input\.avatarUrl\)\)/);
  assert.match(card, /drawPoster\(canvas, resultPoster\(input\), fonts, \{ frame, face: null, prop: null, photo \}\);/);
  assert.match(card, /const fonts = wrappedFontFamilies;/);
  assert.match(card, /await navigator\.share\(\{ files: \[drawn\.file\], text: link \? `\$\{copy\.shareText\} \$\{link\}` : copy\.shareText \}\);/);
  assert.match(card, /if \(error instanceof DOMException && error\.name === 'AbortError'\) return;\s*setNote\('Sharing did not open\. Download the card and post it instead\.'\);/);
  assert.match(card, /download\(drawn\.url, drawn\.file\.name\);\s*const copied = link \? await copyText\(link\) : false;\s*setNote\(copied \? 'Saved\. Your link is copied too\.' : 'Saved to your downloads\.'\);/);
  const wrapped = read('components', 'wrapped', 'ShareFrame.tsx');
  assert.match(wrapped, /import \{ canShareFile, canvasToFile, copyText, download, loadImage \} from '@\/lib\/share-card\/canvas';/);
  assert.match(quiz('ShareResults.tsx'), /const url = useResultsLink\(gameUuid\);/);
});

const row = (rank: number, uuid: string, score: number): QuizRankingRow => ({
  rank,
  user: { uuid, name: `TEST DATA ${uuid}`, username: null, avatar_url: null },
  score,
  correct_count: 5,
  answered_count: 10,
  answerable_count: 10,
  joined_at_question_index: null,
});

test('the final scores are the quiz’s own leaderboard, its podium rising, the reader marked', () => {
  const ranking = [row(1, 'a', 900), row(2, 'me', 800), row(3, 'c', 800), row(4, 'd', 100)];
  const results = {
    game: { uuid: 'g', quiz: { uuid: 'q', title: 'TEST DATA Torts' }, host: null, started_at: null, finished_at: null, player_count: 4, question_count: 10 },
    podium: ranking.slice(0, 3),
    ranking,
    questions: [],
  } as QuizGameResults;
  const board = liveGameBoard(results, 'me');
  assert.equal(board.player_count, 4);
  assert.deepEqual(board.entries.map((entry) => [entry.rank, entry.user.uuid, entry.points]), [
    [1, 'a', 900],
    [2, 'me', 800],
    [3, 'c', 800],
    [4, 'd', 100],
  ]);
  // A tie counts neither ahead nor behind, as on the quiz's own board.
  assert.equal(board.viewer?.players_behind, 1);
  assert.equal(board.viewer?.user?.uuid, 'me');
  assert.equal(liveGameBoard(results, 'watcher').viewer, null);
  assert.equal(liveGameBoard(results, null).viewer, null);

  // Where they study and their level, as the quiz page's board shows them, only when the server sent them.
  const schooled = {
    ...results,
    ranking: [{ ...ranking[0], user: { ...ranking[0].user, institution: 'Nigerian Law School – Lagos Campus', level: '500 Level' } }, ...ranking.slice(1)],
  };
  const withSchool = liveGameBoard(schooled, 'me');
  assert.deepEqual(withSchool.entries[0].user, {
    uuid: 'a',
    name: 'TEST DATA a',
    avatar_url: null,
    institution: 'Nigerian Law School – Lagos Campus',
    level: '500 Level',
  });
  assert.deepEqual(Object.keys(withSchool.entries[1].user), ['uuid', 'name', 'avatar_url']);

  const phases = quiz('GamePhases.tsx');
  assert.match(
    phases,
    /<FrontBoard\s*board=\{liveGameBoard\(results, viewerUuid\)\}\s*rising\s*finished\s*everyone\s*rowNote=\{liveRowNote\(results\)\}\s*rulesNote=\{LIVE_BOARD_RULES_NOTE\}\s*\/>/,
  );
  // Every player is on the board (Arthur's A): twelve players, all twelve entries; a late joiner's row says so.
  const twelve = Array.from({ length: 12 }, (_, i) =>
    i === 10 ? { ...row(11, 'late', 300), joined_at_question_index: 4 } : row(i + 1, `p${i + 1}`, 1000 - i * 50),
  );
  const big = { ...results, game: { ...results.game, player_count: 12 }, podium: twelve.slice(0, 3), ranking: twelve } as QuizGameResults;
  assert.equal(liveGameBoard(big, 'p12').entries.length, 12);
  const note = liveRowNote(big);
  assert.deepEqual(liveGameBoard(big, null).entries.map(note).filter(Boolean), ['Joined late']);
  assert.equal(note(liveGameBoard(big, null).entries[10]), 'Joined late');
  assert.match(phases, /<FrontBoardSkeleton \/>/);
  // The card, and the poster fonts it imports, load only when a finished game shows it.
  assert.match(phases, /const ResultCardShare = dynamic\(\(\) => import\('\.\/ResultCardShare'\)\.then\(\(module\) => module\.ResultCardShare\), \{\s*ssr: false,\s*\}\);/);
  assert.doesNotMatch(phases, /import \{ ResultCardShare \}/);
  assert.doesNotMatch(phases, /PODIUM_HEIGHT|<RankRow/);
  assert.match(LIVE_BOARD_RULES_NOTE, /points in this game/);
  // The quiz's own page is unchanged: no rise, its own note.
  const board2 = read('v2', 'features', 'quiz', 'solo', 'board', 'FrontBoard.tsx');
  assert.match(board2, /rising = false,\s*rulesNote = BOARD_RULES_NOTE,/);
  assert.match(board2, /<Podium entries=\{podium\} isYou=\{isYou\} rising=\{rising\} \/>/);
});

test('a player gets their own card under the board; someone who only watched does not', () => {
  const phases = quiz('GamePhases.tsx');
  assert.match(phases, /const own = viewerUuid === null \? undefined : results\?\.ranking\.find\(\(row\) => row\.user\.uuid === viewerUuid\);\s*if \(!results \|\| !own\) return null;/);
  assert.match(phases, /\{cardInput \? <ResultCardShare gameUuid=\{gameUuid\} input=\{cardInput\} \/> : null\}\s*<ShareResults/);
  assert.match(read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx'), /spaceName=\{space\?\.name \?\? null\}/);
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx'), /spaceName=\{spacePlace\?\.space\.name \?\? null\}/);
  assert.match(read('v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx'), /spaceName=\{channel\.space\.name\}/);
});
