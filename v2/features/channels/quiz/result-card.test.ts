import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CARD_BOTTOM, FOOTER_Y, ordinal, pointsText, resultCardCopy, resultCardLayout, type ResultCardInput } from './result-card';

/* The live quiz's leaderboard and each player's result card (Arthur,
 * f730f71c, 11 November 2026). TEST DATA only. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');
const quiz = (file: string) => read('v2', 'features', 'channels', 'quiz', file);

const INPUT: ResultCardInput = {
  playerName: 'TEST DATA Ada Obi',
  rank: 2,
  score: 8400,
  quizTitle: 'Torts 101',
  spaceName: 'TEST DATA LASU LSS',
  playerCount: 34,
  podium: [
    { rank: 1, name: 'TEST DATA Chidi', score: 9100, isViewer: false },
    { rank: 2, name: 'TEST DATA Ada Obi', score: 8400, isViewer: true },
    { rank: 3, name: 'TEST DATA Bola', score: 7900, isViewer: false },
  ],
};

test('a place reads as people say it', () => {
  const said = [1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 23, 101, 111, 112, 113].map(ordinal);
  assert.deepEqual(said, ['1st', '2nd', '3rd', '4th', '10th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th', '112th', '113th']);
});

test('the card says who came where, in what, with how many points and where it was played', () => {
  const copy = resultCardCopy(INPUT);
  assert.equal(copy.place, '2nd');
  assert.equal(copy.headline, 'TEST DATA Ada Obi came 2nd in Torts 101');
  assert.equal(copy.meta, '34 players · TEST DATA LASU LSS');
  assert.equal(copy.shareText, 'TEST DATA Ada Obi came 2nd in Torts 101, 8,400 pts, TEST DATA LASU LSS. Live quiz on Lawexa.');
  assert.equal(copy.fileName, 'lawexa-quiz-2nd.png');
  assert.equal(pointsText(1), '1 pt');

  // No Space name: the card and its words leave the place out rather than guess.
  const bare = resultCardCopy({ ...INPUT, spaceName: null, playerCount: 1 });
  assert.equal(bare.meta, '1 player');
  assert.equal(bare.shareText, 'TEST DATA Ada Obi came 2nd in Torts 101, 8,400 pts. Live quiz on Lawexa.');
});

// Comfortaa 700 is wide: about 0.62 of the size per letter, a little more than the face measures.
const comfortaa = (text: string, size: number) => text.length * size * 0.62;
const LONG_NAME = 'TEST DATA Oluwaseyifunmi Adebanjo-Okonkwo';
const LONG_TITLE = 'TEST DATA Constitutional Law Two: Fundamental Rights Enforcement and Judicial Review';

test('the card lays out whole: the top three end above the footer whatever the words (techlead review of cd5f6af0)', () => {
  for (const [label, input] of [
    ['short', INPUT],
    ['two-line name', { ...INPUT, playerName: LONG_NAME }],
    ['three-line title', { ...INPUT, quizTitle: LONG_TITLE }],
    ['two-line name and three-line title', { ...INPUT, playerName: LONG_NAME, quizTitle: LONG_TITLE }],
    // Both wrap at their largest sizes (two lines at 92 px, three at 72 px): the tallest block there is.
    ['two lines and three lines at full size', { ...INPUT, playerName: 'TEST DATA Ada Obiora Nwosu', quizTitle: 'TEST DATA Torts and Negligence Review Week Six Quiz' }],
    ['a name too long for two lines', { ...INPUT, playerName: `${LONG_NAME} ${LONG_NAME} ${LONG_NAME}`, quizTitle: LONG_TITLE }],
  ] as const) {
    const layout = resultCardLayout(input, comfortaa);
    assert.ok(layout.bottom <= CARD_BOTTOM, `${label}: the box ends at ${layout.bottom}`);
    assert.ok(CARD_BOTTOM < FOOTER_Y - 32, label);
    assert.ok(layout.name.lines.length <= 2 && layout.title.lines.length <= 3, label);
    assert.ok(layout.box !== null && layout.box.top >= layout.meta.baseline + 20, `${label}: the box sits under the meta line`);
    assert.ok(layout.medal.cy - layout.medal.r >= 180, `${label}: the medal stays under the mark`);
    for (const line of [...layout.name.lines]) assert.ok(comfortaa(line, layout.name.size) <= 1080 - 168, `${label}: "${line}" fits`);
  }
  // Short words keep the full size; the tallest block is drawn smaller to fit; a name past two lines ends with "…".
  assert.equal(resultCardLayout(INPUT, comfortaa).scale, 1);
  const tallest = resultCardLayout({ ...INPUT, playerName: 'TEST DATA Ada Obiora Nwosu', quizTitle: 'TEST DATA Torts and Negligence Review Week Six Quiz' }, comfortaa);
  assert.ok(tallest.name.lines.length === 2 && tallest.title.lines.length === 3, 'the case really is two and three lines');
  const crowded = resultCardLayout({ ...INPUT, playerName: `${LONG_NAME} ${LONG_NAME} ${LONG_NAME}`, quizTitle: LONG_TITLE }, comfortaa);
  assert.ok(crowded.name.lines[1].endsWith('…'));
  // Safari before 16 has no ctx.roundRect.
  assert.doesNotMatch(quiz('result-card.ts'), /ctx\.roundRect\(/);
});

test('a player gets their own card under the podium; someone who only watched does not', () => {
  const phases = quiz('GamePhases.tsx');
  assert.match(phases, /const own = viewerUuid === null \? undefined : results\?\.ranking\.find\(\(row\) => row\.user\.uuid === viewerUuid\);\s*if \(!results \|\| !own\) return null;/);
  assert.match(phases, /\{cardInput \? <ResultCardShare gameUuid=\{gameUuid\} input=\{cardInput\} \/> : null\}\s*<ShareResults/);
  // Every way into a game names its Space for the card.
  assert.match(read('v2', 'features', 'spaces', 'detail', 'SpaceScreen.tsx'), /spaceName=\{space\?\.name \?\? null\}/);
  assert.match(read('v2', 'features', 'conversations', 'conversation', 'ConversationScreen.tsx'), /spaceName=\{spacePlace\?\.space\.name \?\? null\}/);
  assert.match(read('v2', 'features', 'channels', 'screen', 'ChannelScreen.tsx'), /spaceName=\{channel\.space\.name\}/);
});

test('the card is shared and saved the way Wrapped’s is, with the results link', () => {
  const card = quiz('ResultCardShare.tsx');
  assert.match(card, /from '@\/lib\/share-card\/canvas'/);
  assert.match(card, /await navigator\.share\(\{ files: \[drawn\.file\], text: link \? `\$\{copy\.shareText\} \$\{link\}` : copy\.shareText \}\);/);
  // A dismissed sheet says nothing and saves nothing; a sheet that fails says so.
  assert.match(card, /if \(error instanceof DOMException && error\.name === 'AbortError'\) return;\s*setNote\('Sharing did not open\. Download the card and post it instead\.'\);/);
  // No picture sheet: saved, and the link copied, as Wrapped does.
  assert.match(card, /download\(drawn\.url, drawn\.file\.name\);\s*const copied = link \? await copyText\(link\) : false;\s*setNote\(copied \? 'Saved\. Your link is copied too\.' : 'Saved to your downloads\.'\);/);
  // The ranking says "pt" for one point, like the card.
  assert.match(quiz('ui.tsx'), /\{score\.toLocaleString\(\)\}\{' '\}\s*<span[^>]*>\s*\{pointsUnit\(score\)\}/);
  const wrapped = read('components', 'wrapped', 'ShareFrame.tsx');
  assert.match(wrapped, /import \{ canShareFile, canvasToFile, copyText, download, loadImage \} from '@\/lib\/share-card\/canvas';/);
  // One results link for both shares.
  assert.match(quiz('ShareResults.tsx'), /const url = useResultsLink\(gameUuid\);/);
  assert.match(card, /const link = useResultsLink\(gameUuid\);/);
});
