import { fitText, type Measure } from '@/lib/share-card/text-fit';

/**
 * The live quiz's result card: one player's finish as a 1080 × 1920 PNG, for
 * a WhatsApp Status or a story (Arthur, f730f71c, 11 November 2026: "a
 * shareable card just like we did for the Wrapped").
 *
 * Made the way Wrapped makes its poster (`lib/wrapped/share-image.ts`): drawn
 * on the phone straight onto a canvas, never captured from the page and never
 * rendered on a server, so it is the same picture on every phone and costs no
 * request. The share sheet, the save and the image loading are Wrapped's
 * (`lib/share-card/canvas.ts`).
 *
 * THE QUIZ'S LOOK: the dark ground of the quiz in dark mode, the gold medal
 * on its lip, Comfortaa for the numbers and the names, and the Lawexa mark in
 * gold. What it says: the place, who, the quiz, the points, where it was
 * played, and the top three with the player's own row lit.
 */

export const RESULT_CARD = { width: 1080, height: 1920 } as const;

export interface ResultCardRow {
  rank: number;
  name: string;
  score: number;
  isViewer: boolean;
}

export interface ResultCardInput {
  playerName: string;
  rank: number;
  score: number;
  quizTitle: string;
  /** The Space the game was played in; left out when unknown. */
  spaceName: string | null;
  playerCount: number;
  /** The top three, best first. */
  podium: ResultCardRow[];
}

export interface ResultCardFonts {
  /** The CSS family next/font gave Comfortaa. */
  display: string;
  /** The page's body family. */
  body: string;
}

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd, 101st, 111th. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** The points' unit: "pt" for one, "pts" otherwise (the card and the ranking both). */
export function pointsUnit(score: number): string {
  return score === 1 ? 'pt' : 'pts';
}

/** Points as the game shows them, with the unit. */
export function pointsText(score: number): string {
  return `${score.toLocaleString('en-US')} ${pointsUnit(score)}`;
}

/** The card's words, and the words that go with it to the share sheet. Pure, so a test pins it. */
export function resultCardCopy(input: ResultCardInput): {
  place: string;
  headline: string;
  meta: string;
  shareText: string;
  fileName: string;
} {
  const place = ordinal(input.rank);
  const players = `${input.playerCount} ${input.playerCount === 1 ? 'player' : 'players'}`;
  const where = input.spaceName ? ` · ${input.spaceName}` : '';
  const headline = `${input.playerName} came ${place} in ${input.quizTitle}`;
  return {
    place,
    headline,
    meta: `${players}${where}`,
    shareText: `${headline}, ${pointsText(input.score)}${input.spaceName ? `, ${input.spaceName}` : ''}. Live quiz on Lawexa.`,
    fileName: `lawexa-quiz-${place}.png`,
  };
}


/* ── Layout ───────────────────────────────────────────────────────────────── */

/** The top three's box ends here at the latest, clear of the footer line at `FOOTER_Y`. */
export const CARD_BOTTOM = 1780;
export const FOOTER_Y = 1840;
const PAD = 84;
const TEXT_WIDTH = RESULT_CARD.width - PAD * 2;
const NAME_LINES = 2;
const TITLE_LINES = 3;

export interface ResultCardLayout {
  /** 1 at full size; smaller when the words need the room. */
  scale: number;
  medal: { cx: number; cy: number; r: number };
  name: { size: number; lines: string[]; baselines: number[] };
  came: { size: number; baseline: number };
  title: { size: number; lines: string[]; baselines: number[] };
  pill: { top: number; h: number; size: number };
  meta: { size: number; baseline: number };
  box: { top: number; h: number; rowH: number } | null;
  /** The lowest point drawn above the footer, the box's lip included. */
  bottom: number;
}

/** At most `maxLines` lines; a longer text keeps its first lines and ends the last with "…". */
function clampLines(lines: string[], maxLines: number, size: number, measure: Measure): string[] {
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`;
  while (last.length > 1 && measure(`${last}…`, size) > TEXT_WIDTH) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}…`;
  return kept;
}

function layoutAt(input: ResultCardInput, measure: Measure, s: number): ResultCardLayout {
  const px = (n: number) => Math.round(n * s);
  const r = px(190);
  const medal = { cx: RESULT_CARD.width / 2, cy: 200 + r, r };
  let y = medal.cy + r + 16 + px(70);

  const nameFit = fitText(input.playerName, { width: TEXT_WIDTH, maxLines: NAME_LINES, max: px(92), min: px(56), step: 2 }, measure);
  const nameLines = clampLines(nameFit.lines, NAME_LINES, nameFit.size, measure);
  const nameBaselines = nameLines.map(() => (y += nameFit.size * 1.05));

  y += px(70);
  const came = { size: px(42), baseline: y };

  const titleFit = fitText(input.quizTitle, { width: TEXT_WIDTH, maxLines: TITLE_LINES, max: px(72), min: px(44), step: 2 }, measure);
  const titleLines = clampLines(titleFit.lines, TITLE_LINES, titleFit.size, measure);
  const titleBaselines = titleLines.map(() => (y += titleFit.size * 1.12));

  const pill = { top: y + px(60), h: px(120), size: px(64) };
  const meta = { size: px(36), baseline: pill.top + pill.h + 10 + px(64) };

  const rows = Math.min(input.podium.length, 3);
  let box: ResultCardLayout['box'] = null;
  let bottom = meta.baseline + 10;
  if (rows > 0) {
    const rowH = px(112);
    const h = rows * rowH + px(48);
    // The box sits low on the card, above the footer; with long words it follows the meta line.
    const top = Math.max(meta.baseline + px(64), CARD_BOTTOM - 10 - h);
    box = { top, h, rowH };
    bottom = top + h + 10;
  }
  return {
    scale: s,
    medal,
    name: { size: nameFit.size, lines: nameLines, baselines: nameBaselines },
    came,
    title: { size: titleFit.size, lines: titleLines, baselines: titleBaselines },
    pill,
    meta,
    box,
    bottom,
  };
}

/**
 * Where everything sits (techlead's review of cd5f6af0). The block is measured
 * whole first: at full size when it fits, else everything (medal, type, rows)
 * a step smaller together until the top three end by `CARD_BOTTOM`, so a
 * two-line name over a three-line title never reaches the footer or the
 * canvas's edge. A name past two lines, or a title past three, ends in "…".
 * Pure (the canvas's measure is passed in), so a test pins it.
 */
export function resultCardLayout(input: ResultCardInput, measure: Measure): ResultCardLayout {
  let layout = layoutAt(input, measure, 1);
  for (let s = 0.96; layout.bottom > CARD_BOTTOM && s >= 0.6; s -= 0.04) layout = layoutAt(input, measure, s);
  return layout;
}

/* ── Drawing ──────────────────────────────────────────────────────────────── */

const INK = '#111111';
const CARD = '#1c1c1c';
const CARD_BORDER = '#333333';
const LIP = '#000000';
const GOLD = '#c99414';
const GOLD_DEEP = '#775400';
const WHITE = '#fafafa';
const MUTED = '#a3a3a3';

/** A rounded rectangle's path from arcs: `ctx.roundRect` throws on Safari before 16. */
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A card on its lip, as the quiz draws its cards and buttons. */
function raisedCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  roundRectPath(ctx, x, y + 10, w, h, radius);
  ctx.fillStyle = LIP;
  ctx.fill();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = CARD_BORDER;
  ctx.stroke();
}

function trimToWidth(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

export function drawResultCard(
  canvas: HTMLCanvasElement,
  input: ResultCardInput,
  fonts: ResultCardFonts,
  logo: HTMLImageElement | null,
): void {
  canvas.width = RESULT_CARD.width;
  canvas.height = RESULT_CARD.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = RESULT_CARD.width;
  const copy = resultCardCopy(input);
  const display = (size: number) => `700 ${size}px ${fonts.display}`;
  const body = (size: number, weight = 500) => `${weight} ${size}px ${fonts.body}`;
  const measureDisplay: Measure = (text, size) => {
    ctx.font = display(size);
    return ctx.measureText(text).width;
  };
  const L = resultCardLayout(input, measureDisplay);
  const px = (n: number) => Math.round(n * L.scale);
  const cx = L.medal.cx;
  ctx.textBaseline = 'alphabetic';

  // The ground, with the gold glow the medal sits in.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, RESULT_CARD.height);
  const glow = ctx.createRadialGradient(cx, L.medal.cy, 40, cx, L.medal.cy, 720);
  glow.addColorStop(0, 'rgba(201, 148, 20, 0.28)');
  glow.addColorStop(1, 'rgba(201, 148, 20, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, L.medal.cy + 760);

  // The mark, and what this is.
  if (logo) {
    const h = 64;
    ctx.drawImage(logo, PAD, 96, (logo.width / logo.height) * h, h);
  }
  ctx.fillStyle = GOLD;
  ctx.font = body(30, 700);
  ctx.textAlign = 'right';
  ctx.fillText('LIVE QUIZ', W - PAD, 140);

  // The medal: the place in gold, on its lip.
  const { cy, r } = L.medal;
  ctx.beginPath();
  ctx.arc(cx, cy + 16, r, 0, Math.PI * 2);
  ctx.fillStyle = GOLD_DEEP;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  let placeSize = px(170);
  while (placeSize > px(90) && measureDisplay(copy.place, placeSize) > r * 1.6) placeSize -= 6;
  ctx.font = display(placeSize);
  ctx.fillText(copy.place, cx, cy + placeSize * 0.36);

  // Who, and in what.
  ctx.font = display(L.name.size);
  ctx.fillStyle = WHITE;
  L.name.lines.forEach((line, i) => ctx.fillText(line, cx, L.name.baselines[i]));
  ctx.font = body(L.came.size, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(`came ${copy.place} in`, cx, L.came.baseline);
  ctx.font = display(L.title.size);
  ctx.fillStyle = GOLD;
  L.title.lines.forEach((line, i) => ctx.fillText(line, cx, L.title.baselines[i]));

  // The points, as a raised pill.
  const points = pointsText(input.score);
  ctx.font = display(L.pill.size);
  const pillW = ctx.measureText(points).width + px(112);
  raisedCard(ctx, cx - pillW / 2, L.pill.top, pillW, L.pill.h, px(40));
  ctx.fillStyle = WHITE;
  ctx.fillText(points, cx, L.pill.top + L.pill.h * 0.7);
  ctx.font = body(L.meta.size, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(trimToWidth(ctx, copy.meta, TEXT_WIDTH), cx, L.meta.baseline);

  // The top three, the player's own row lit.
  if (L.box) {
    const { top, h, rowH } = L.box;
    raisedCard(ctx, PAD, top, W - PAD * 2, h, px(40));
    input.podium.slice(0, 3).forEach((row, i) => {
      const ry = top + px(24) + i * rowH;
      const dy = ry + rowH / 2;
      if (row.isViewer) {
        roundRectPath(ctx, PAD + 16, ry + px(8), W - PAD * 2 - 32, rowH - px(16), px(28));
        ctx.fillStyle = 'rgba(201, 148, 20, 0.18)';
        ctx.fill();
      }
      // The rank in a gold disc for first, an outlined one after.
      const dx = PAD + px(80);
      ctx.beginPath();
      ctx.arc(dx, dy, px(32), 0, Math.PI * 2);
      if (row.rank === 1) {
        ctx.fillStyle = GOLD;
        ctx.fill();
      } else {
        ctx.lineWidth = 4;
        ctx.strokeStyle = CARD_BORDER;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.font = display(px(34));
      ctx.fillStyle = row.rank === 1 ? INK : WHITE;
      ctx.fillText(String(row.rank), dx, dy + px(12));
      ctx.textAlign = 'right';
      ctx.font = display(px(38));
      ctx.fillStyle = row.isViewer ? GOLD : WHITE;
      const score = pointsText(row.score);
      ctx.fillText(score, W - PAD - px(48), dy + px(13));
      const scoreW = ctx.measureText(score).width;
      ctx.textAlign = 'left';
      ctx.font = body(px(38), row.isViewer ? 700 : 500);
      ctx.fillStyle = WHITE;
      const nameX = dx + px(56);
      ctx.fillText(trimToWidth(ctx, row.name, W - PAD - px(48) - scoreW - px(32) - nameX), nameX, dy + px(13));
    });
  }

  // Where to play.
  ctx.textAlign = 'center';
  ctx.font = body(32, 700);
  ctx.fillStyle = MUTED;
  ctx.fillText('Play live quizzes with your class on lawexa.com', cx, FOOTER_Y);
}
