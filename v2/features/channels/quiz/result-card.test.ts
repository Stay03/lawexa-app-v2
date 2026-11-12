import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { QuizGameResults, QuizRankingRow } from '@/types/channel-quiz';
import { LIVE_BOARD_RULES_NOTE, liveGameBoard, liveRowNote } from './live-board';
import { quizShareInvite } from '@/lib/constants/quiz-share';
import {
  accuracyPercent,
  cardCta,
  cardHeadline,
  cardInitials,
  cardName,
  cardPlace,
  cardStats,
  cardSubline,
  cardTier,
  podiumText,
  pointsText,
  resultCardCopy,
  shareCaption,
  topPercent,
  type ResultCardInput,
} from './result-card';
import { drawResultCard } from './result-card-draw';
import { CARD_FONT_FACES } from './result-card-fonts';
import { CARD_LAYOUTS, ellipsize, headlineSetting, sublineLines, type Measure } from './result-card-layout';

/* The live quiz's final scores and each player's card: the quiz's own
 * leaderboard (Arthur, f730f71c), and his share card for every place, as a
 * story and a square (Arthur, f9645a22, 12 November 2026). The card's words
 * and numbers are checked against his files. TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const quiz = (file: string) => read('v2', 'features', 'channels', 'quiz', file);

/** Arthur's sample player: Ada H., one of 70, in Torts 101. */
const ADA: ResultCardInput = {
  playerName: 'Ada Hassan',
  avatarUrl: null,
  rank: 1,
  score: 19339,
  correctCount: 10,
  answerableCount: 10,
  quizTitle: 'Torts 101',
  spaceName: 'LASU LSS',
  playerCount: 70,
};

test('every place has Arthur’s headline, word for word, and every place past 10th shares his last card', () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, i) => cardHeadline(i + 1).join(' / ')),
    [
      'Gold, / my lord.',
      'Silver, / my lord.',
      'Bronze, / my lord.',
      'Just off / the podium.',
      'Top five. / No objection.',
      'Motion / granted.',
      'Top 10. / Sustained.',
      'On the / record.',
      'Leave / granted.',
      'Last seat / at the Bar.',
    ],
  );
  for (const rank of [11, 23, 70, 1000]) assert.deepEqual(cardHeadline(rank), ['Adjourned,', 'not dismissed.']);
  assert.equal(cardCta(10), 'Think you can beat me?');
  assert.equal(cardCta(11), 'See you next sitting.');
  assert.deepEqual([1, 2, 3, 4, 10, 11].map(cardTier), ['gold', 'silver', 'bronze', 'top10', 'top10', 'field']);
});

test('"Top N%" is the place over the players, rounded up, as on every one of Arthur’s cards', () => {
  // His eleven samples, all of 70 players.
  const arthur: [number, number][] = [[1, 2], [2, 3], [3, 5], [4, 6], [5, 8], [6, 9], [7, 10], [8, 12], [9, 13], [10, 15], [23, 33]];
  for (const [rank, percent] of arthur) assert.equal(topPercent(rank, 70), percent, `${rank} of 70`);
  // Never the top 0%, never past 100%, and a place past the count (a stale count) reads as last.
  assert.equal(topPercent(1, 1000), 1);
  assert.equal(topPercent(1, 1), 100);
  assert.equal(topPercent(5, 3), 100);
  assert.equal(topPercent(1, 0), 100);
});

test('the card’s line, stats and share words name the player as Arthur’s does', () => {
  assert.equal(cardName('Ada Hassan'), 'Ada H.');
  assert.equal(cardName('Tobi'), 'Tobi');
  assert.equal(cardName('  Oluwaseyifunmi   Adebanjo-Okonkwo '), 'Oluwaseyifunmi A.');
  assert.equal(cardInitials('Ada Hassan'), 'AH');
  assert.equal(cardInitials('ọlá adé'), 'ỌA');
  assert.equal(cardInitials('Tobi'), 'T');
  assert.deepEqual(cardSubline(ADA), { lead: 'Ada H. placed 1st of 70 in', title: 'Torts 101' });
  assert.deepEqual(cardSubline({ ...ADA, rank: 23, playerCount: 1204, quizTitle: '  Land   Law ' }), {
    lead: 'Ada H. placed 23rd of 1,204 in',
    title: 'Land Law',
  });
  assert.deepEqual(cardStats(ADA), [
    { value: '19,339', label: 'points' },
    { value: '10/10', label: 'correct' },
    { value: 'Top 2%', label: 'of players' },
  ]);
  // A late joiner is out of the questions they could answer; one point is a point.
  assert.deepEqual(cardStats({ ...ADA, score: 1, correctCount: 3, answerableCount: 7 }).slice(0, 2), [
    { value: '1', label: 'point' },
    { value: '3/7', label: 'correct' },
  ]);
  assert.equal(pointsText(1), '1 pt');

  const story = resultCardCopy(ADA, 'story');
  assert.equal(story.fileName, 'lawexa-quiz-1st-story.png');
  assert.equal(resultCardCopy(ADA, 'square').fileName, 'lawexa-quiz-1st-square.png');
  assert.equal(story.shareText, 'Ada H. placed 1st of 70 in Torts 101, LASU LSS. Think you can beat me? Play the live quiz on Lawexa.');
  assert.equal(resultCardCopy({ ...ADA, spaceName: null, rank: 23 }, 'story').shareText, 'Ada H. placed 23rd of 70 in Torts 101. See you next sitting. Play the live quiz on Lawexa.');
  assert.equal(story.alt, 'Gold, my lord. Ada H. placed 1st of 70 in Torts 101. 19,339 points, 10/10 correct, Top 2% of players.');
});

// DM Sans Medium is about 0.45 of the size per character (Arthur's line, measured); 0.5 errs long.
const fake: Measure = (text, font) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 0);
  return [...text].length * size * 0.5;
};

test('the headline sits where Arthur set it for each place, in both sizes', () => {
  assert.deepEqual(headlineSetting('story', 1), { size: 140, baselines: [472, 605], sublineTop: 685 });
  assert.deepEqual(headlineSetting('story', 5), { size: 128, baselines: [462, 584], sublineTop: 685 });
  assert.deepEqual(headlineSetting('story', 23), { size: 119, baselines: [456, 569], sublineTop: 685 });
  assert.deepEqual(headlineSetting('square', 1), { size: 88, baselines: [270, 354], sublineTop: 425 });
  assert.deepEqual(headlineSetting('square', 4), { size: 68, baselines: [254, 319], sublineTop: 387 });
  assert.deepEqual(headlineSetting('square', 5), { size: 57, baselines: [246, 300], sublineTop: 366 });
  assert.deepEqual(headlineSetting('square', 7), { size: 74, baselines: [259, 329], sublineTop: 399 });
  assert.deepEqual(headlineSetting('square', 10), { size: 68, baselines: [254, 319], sublineTop: 387 });
  assert.deepEqual(headlineSetting('square', 99), { size: 53, baselines: [242, 292], sublineTop: 359 });
  assert.equal(CARD_LAYOUTS.story.height, 1920);
  assert.equal(CARD_LAYOUTS.square.height, 1080);
});

test('a long name or quiz title shortens the line under the headline, never running off the card', () => {
  // Arthur's own line: one line on the story, and on the square "Torts 101" goes to a second line.
  const { lead, title } = cardSubline(ADA);
  assert.deepEqual(sublineLines(lead, title, 'story', 1, fake), { size: 36, lines: [{ text: 'Ada H. placed 1st of 70 in Torts 101', baseline: 685 }] });
  assert.deepEqual(sublineLines(lead, title, 'square', 1, fake).lines, [
    { text: 'Ada H. placed 1st of 70 in', baseline: 425 },
    { text: 'Torts 101', baseline: 464 },
  ]);

  const long = cardSubline({ ...ADA, playerName: 'Oluwaseyifunmi Adebanjo', quizTitle: 'Constitutional Law Two: Fundamental Rights Enforcement and Judicial Review' });
  const story = sublineLines(long.lead, long.title, 'story', 1, fake);
  assert.equal(story.size, 28);
  assert.equal(story.lines.length, 1);
  assert.ok(story.lines[0].text.startsWith('Oluwaseyifunmi A. placed 1st of 70 in Constitutional'), story.lines[0].text);
  assert.ok(story.lines[0].text.endsWith('…'));
  assert.ok(fake(story.lines[0].text, '500 28px x') <= CARD_LAYOUTS.story.subline.maxWidth);

  // The square keeps every line in its column and clear of the line over the button (baseline 540).
  for (const rank of [1, 5, 23]) {
    const square = sublineLines(long.lead, long.title, 'square', rank, fake);
    for (const line of square.lines) assert.ok(fake(line.text, '500 30px x') <= CARD_LAYOUTS.square.subline.maxWidth, line.text);
    assert.ok(square.lines.at(-1)!.baseline <= CARD_LAYOUTS.square.subline.lastBaseline);
    assert.ok(square.lines.at(-1)!.text.endsWith('…'), JSON.stringify(square.lines));
  }
  // A shorter heading leaves room for more lines: two under Gold, four under Adjourned.
  assert.equal(sublineLines(long.lead, long.title, 'square', 1, fake).lines.length, 2);
  assert.equal(sublineLines(long.lead, long.title, 'square', 23, fake).lines.length, 4);
  assert.equal(ellipsize('Torts 101', () => false), '…');
});

interface Drawn {
  text: string;
  x: number;
  y: number;
  font: string;
  fill: string;
}

/** A 2D context that records what the card draws: its texts with where and how, and how many circles. */
function recordingCanvas() {
  const texts: Drawn[] = [];
  let arcs = 0;
  let images = 0;
  const ctx = {
    font: '',
    fillStyle: '' as unknown,
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    measureText: (text: string) => {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 0);
      return { width: [...text].length * size * 0.55, actualBoundingBoxAscent: size * 0.7, actualBoundingBoxDescent: 0 };
    },
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y, font: ctx.font, fill: String(ctx.fillStyle) }),
    arc: () => {
      arcs += 1;
    },
    drawImage: () => {
      images += 1;
    },
    createLinearGradient: () => ({ addColorStop: () => undefined }),
  };
  for (const name of ['fillRect', 'beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'closePath', 'fill', 'stroke', 'clip', 'save', 'restore', 'translate', 'scale']) {
    (ctx as Record<string, unknown>)[name] = () => undefined;
  }
  const canvas = { width: 0, height: 0, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, texts, counts: () => ({ arcs, images }) };
}

/** The texts drawn whole (untracked), and the tracked ones put back together by baseline. */
function words(texts: Drawn[]): string[] {
  const lines = new Map<number, string>();
  for (const drawn of texts) lines.set(drawn.y, (lines.get(drawn.y) ?? '') + (drawn.text.length === 1 ? drawn.text : `|${drawn.text}|`));
  return [...lines.values()];
}

test('the card draws Arthur’s parts for the place: crown and medal, medal, "Top 10", or the podium alone', () => {
  const draw = (rank: number, format: 'story' | 'square' = 'story', photo = false) => {
    const recording = recordingCanvas();
    const image = photo ? ({ width: 400, height: 400 } as unknown as CanvasImageSource & { width: number; height: number }) : null;
    drawResultCard(recording.canvas, { ...ADA, rank }, format, image);
    return { ...recording, all: words(recording.texts).join('\n') };
  };

  const first = draw(1);
  assert.equal(first.canvas.width, 1080);
  assert.equal(first.canvas.height, 1920);
  for (const text of ['|Lawexa live quiz|', 'Gold,', 'my lord.', '|Ada H. placed 1st of 70 in Torts 101|', '|Think you can beat me?|', '|Play at lawexa.com|', '|19,339|', '|points|', '|10/10|', '|correct|', '|Top 2%|', '|of players|', '1st']) {
    assert.ok(first.all.includes(text), `1st draws ${text}`);
  }
  // The medal's number, at the medal's own baseline; the place under it in large type.
  const medal = first.texts.find((drawn) => drawn.text === '1' && /64px/.test(drawn.font));
  assert.ok(medal, 'the medal carries "1"');
  assert.ok(first.texts.some((drawn) => drawn.y === 1244 && /170px/.test(drawn.font)), 'the place on the podium');
  assert.ok(first.texts.some((drawn) => drawn.y === 685 && drawn.text.startsWith('Ada H.')), 'the line under the headline');
  assert.ok(first.texts.every((drawn) => !drawn.text.includes('Top 10')), 'no Top 10 pill on the podium');

  // 4th to 10th: the pill instead of the medal; no medal number.
  const fifth = draw(5);
  assert.ok(fifth.all.includes('|Top 10|'));
  assert.ok(!fifth.texts.some((drawn) => /64px/.test(drawn.font) && /^[0-9]$/.test(drawn.text)), 'no medal');
  // Past 10th: neither, and Arthur's other line.
  const late = draw(23);
  assert.ok(!late.all.includes('|Top 10|'));
  assert.ok(late.all.includes('|See you next sitting.|'));
  assert.ok(late.all.includes('Adjourned,'));

  // The crown is only for 1st: three balls more than 2nd (medal rims, photo circle and button corners being equal).
  assert.equal(draw(1).counts().arcs - draw(2).counts().arcs, 3);
  // No photo: the initials in the gold circle; a photo: drawn, and no initials.
  assert.ok(draw(1).texts.some((drawn) => drawn.text === 'A' && drawn.fill === '#171307'));
  const withPhoto = draw(1, 'story', true);
  assert.equal(withPhoto.counts().images, 1);
  assert.ok(!withPhoto.texts.some((drawn) => drawn.text === 'A' && drawn.fill === '#171307'));

  // The square: its size, the headline at the column's left, the line under it wrapped as Arthur's.
  const square = draw(1, 'square');
  assert.equal(square.canvas.height, 1080);
  assert.ok(square.texts.some((drawn) => drawn.text === 'G' && drawn.x === 600 && drawn.y === 270));
  assert.ok(square.texts.some((drawn) => drawn.y === 425 && drawn.x === 600));
  assert.ok(square.texts.some((drawn) => drawn.text === 'Think you can beat me?' && drawn.x === 600 && drawn.y === 540));
});

test('the card is drawn on the device with its own fonts, in both sizes, and Wrapped is left as it is live', () => {
  // Every face the card asks for is served, with its licence beside it.
  for (const face of CARD_FONT_FACES) assert.ok(existsSync(join(process.cwd(), 'public', 'fonts', 'live-quiz-card', face.file)), face.file);
  for (const licence of ['OFL-bricolage-grotesque.txt', 'OFL-dm-sans.txt']) {
    assert.match(read('public', 'fonts', 'live-quiz-card', licence), /SIL Open Font License, Version 1\.1/);
  }

  const card = quiz('ResultCardShare.tsx');
  assert.match(card, /loadCardFonts\(cardText\(input\)\), loadImage\(corsPhotoUrl\(input\.avatarUrl\)\)/);
  assert.match(card, /for \(const each of CARD_FORMATS\) \{\s*const canvas = document\.createElement\('canvas'\);\s*drawResultCard\(canvas, input, each, photo\);/);
  assert.match(card, /<TabsTrigger key=\{each\} value=\{each\}/);
  assert.match(card, /await navigator\.share\(\{ files: \[current\.file\], text: caption \}\);/);
  assert.match(card, /if \(error instanceof DOMException && error\.name === 'AbortError'\) return;\s*setNote\('Sharing did not open\. Download the card and post it instead\.'\);/);
  assert.match(card, /download\(current\.url, current\.file\.name\);\s*const copied = await copyText\(caption\);\s*setNote\(copied \? 'Saved\. Caption and link copied\.' : 'Saved to your downloads\.'\);/);
  assert.match(quiz('ShareResults.tsx'), /const url = useResultsLink\(gameUuid\);/);

  // Wrapped keeps its own card: the live quiz only borrows the picture helpers it already exported.
  assert.doesNotMatch(card, /drawShareCard|wrappedFontFamilies|wrappedArt/);
  assert.ok(!existsSync(join(process.cwd(), 'lib', 'share-card')), 'no shared card module');
  assert.match(read('lib', 'wrapped', 'share-image.ts'), /export function drawShareCard\(canvas: HTMLCanvasElement, record: WrappedRecord, fonts: ShareFonts, art: ShareArt\): void \{/);
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
    /<FrontBoard\s*board=\{liveGameBoard\(results, viewerUuid\)\}\s*rising\s*finished\s*everyone\s*unranked=\{results\.game\.player_count < 2\}\s*rowNote=\{liveRowNote\(results\)\}\s*rulesNote=\{LIVE_BOARD_RULES_NOTE\}\s*\/>/,
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

// Arthur's corrections (0f517a68, e3d57458, 12 November 2026), as the techlead set them.
const SOLO: ResultCardInput = { ...ADA, playerCount: 1, score: 7120, correctCount: 7, answerableCount: 10 };

test('a one-player card claims no place: no rank, ordinal or percentile; the score and how it went instead', () => {
  assert.equal(cardPlace(SOLO), null);
  assert.equal(cardPlace({ ...ADA, rank: 2, playerCount: 8 }), 2);
  assert.equal(cardTier(cardPlace(SOLO)), 'field');
  assert.deepEqual(cardHeadline(null), ['Case', 'closed.']);
  assert.equal(cardCta(null), 'Think you can beat me?');
  assert.deepEqual(cardSubline(SOLO), { lead: 'Ada H. scored 7,120 points in', title: 'Torts 101' });
  assert.deepEqual(cardStats(SOLO), [
    { value: '7,120', label: 'points' },
    { value: '7/10', label: 'correct' },
    { value: '70%', label: 'accuracy' },
  ]);
  assert.equal(podiumText(SOLO), '7,120 pts');
  const copy = resultCardCopy(SOLO, 'story');
  assert.equal(copy.fileName, 'lawexa-quiz-score-story.png');
  assert.equal(copy.shareText, 'Ada H. scored 7,120 points in Torts 101, LASU LSS. Think you can beat me? Play the live quiz on Lawexa.');
  assert.equal(copy.alt, 'Case closed. Ada H. scored 7,120 points in Torts 101. 7,120 points, 7/10 correct, 70% accuracy.');
  for (const text of [copy.shareText, copy.alt]) assert.doesNotMatch(text, /\b1st\b|\bTop\b|of 1\b|placed/);
  // The headline is set as the card past the top 10.
  assert.deepEqual(headlineSetting('story', null), headlineSetting('story', 23));
  assert.deepEqual(headlineSetting('square', null), headlineSetting('square', 23));
});

test('two or more players show the place; "Top N%" only from 10 players, accuracy below', () => {
  const second = { ...ADA, rank: 2, playerCount: 8, correctCount: 9, answerableCount: 10 };
  assert.deepEqual(cardSubline(second).lead, 'Ada H. placed 2nd of 8 in');
  assert.deepEqual(cardStats(second)[2], { value: '90%', label: 'accuracy' });
  assert.equal(podiumText(second), '2nd');
  const fifth = { ...ADA, rank: 5, playerCount: 12 };
  assert.deepEqual(cardStats(fifth)[2], { value: 'Top 42%', label: 'of players' });
  assert.deepEqual(cardStats({ ...ADA, rank: 2, playerCount: 9 })[2].label, 'accuracy');
  assert.deepEqual(cardStats({ ...ADA, rank: 2, playerCount: 10 })[2], { value: 'Top 20%', label: 'of players' });
  assert.equal(accuracyPercent(2, 3), 67);
  assert.equal(accuracyPercent(0, 0), 0);
  assert.equal(accuracyPercent(5, 4), 100);
});

test('a one-player card draws no crown, medal or "Top 10", and its points on the podium', () => {
  const recording = recordingCanvas();
  drawResultCard(recording.canvas, SOLO, 'story', null);
  const all = words(recording.texts).join('\n');
  for (const text of ['Case', 'closed.', '|Ada H. scored 7,120 points in Torts 101|', '|70%|', '|accuracy|']) assert.ok(all.includes(text), text);
  assert.ok(!all.includes('|Top 10|'));
  assert.ok(!recording.texts.some((drawn) => /64px/.test(drawn.font) && /^[0-9]$/.test(drawn.text)), 'no medal');
  assert.ok(!/1st|Top \d+%/.test(all));
  // The crown is three balls: a one-player 1st draws as few arcs as a 2nd with a medal removed would, never the crown's.
  const second = recordingCanvas();
  drawResultCard(second.canvas, { ...ADA, rank: 23 }, 'story', null);
  assert.equal(recording.counts().arcs, second.counts().arcs);
});

test('the share carries a caption, the card words and the link; where the sheet takes no picture the caption is copied; Download is the picture alone', () => {
  assert.equal(shareCaption('Ada H. placed 2nd of 8 in Torts 101.', 'https://lawexa.com/q/r/abc'), 'Ada H. placed 2nd of 8 in Torts 101. https://lawexa.com/q/r/abc');
  assert.equal(shareCaption('Ada H. placed 2nd of 8 in Torts 101.', null), 'Ada H. placed 2nd of 8 in Torts 101.');
  const share = quiz('ResultCardShare.tsx');
  assert.match(share, /const caption = shareCaption\(copy\.shareText, link\);/);
  assert.match(share, /await navigator\.share\(\{ files: \[current\.file\], text: caption \}\);/);
  assert.match(share, /download\(current\.url, current\.file\.name\);\s*const copied = await copyText\(caption\);/);
  const save = share.slice(share.indexOf('const save = () => {'), share.indexOf('const share = async'));
  assert.doesNotMatch(save, /copyText|navigator\.share/);
});

test('the invite under a one-player game claims no place either', () => {
  assert.deepEqual(quizShareInvite({ outcome: 'solo' }), {
    headline: 'Can anyone beat your score?',
    ask: 'Share this challenge with your study group and find out.',
  });
  assert.match(quiz('GamePhases.tsx'), /: results\.game\.player_count < 2\s*\? \{ outcome: 'solo' \}\s*: viewerRow\.rank === 1/);
});

test('a one-player game ranks no one on its board: the row and its points, no podium, crown or place; other boards unchanged', () => {
  const board = read('v2', 'features', 'quiz', 'solo', 'board', 'FrontBoard.tsx');
  // The prop is off unless asked for, so the quiz's own page and every 2+ player game draw as before.
  assert.match(board, /everyone = false,\s*unranked = false,/);
  const unranked = board.slice(board.indexOf(') : unranked ? ('), board.indexOf('<div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:gap-6">'));
  assert.match(unranked, /<PlayerLine rank=\{null\} user=\{entry\.user\} points=\{entry\.points\} you=\{isYou\(entry\)\}/);
  assert.match(unranked, /\{standing \? <p className="text-center text-sm font-medium text-foreground\/80">\{standing\}<\/p> : null\}/);
  assert.doesNotMatch(unranked, /<Podium|Crown|Trophy/);
  // A row without a place drops the trophy and the number; a ranked row keeps them.
  assert.match(board, /\{rank !== null \? \(\s*<span className="flex w-9 shrink-0 items-center gap-1/);
  assert.match(board, /<PlayerLine rank=\{entry\.rank\} user=\{entry\.user\}/);
  assert.match(board, /<PlayerLine rank=\{viewer\.rank\} user=\{user\}/);
  // The quiz's own page passes no such prop.
  assert.match(read('v2', 'features', 'quiz', 'solo', 'front', 'QuizFrontScreen.tsx'), /<FrontBoard board=\{board\} \/>/);
});
