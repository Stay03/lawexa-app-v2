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

/** Points as the game shows them, with the unit. */
export function pointsText(score: number): string {
  return `${score.toLocaleString('en-US')} ${score === 1 ? 'pt' : 'pts'}`;
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

const INK = '#111111';
const CARD = '#1c1c1c';
const CARD_BORDER = '#333333';
const LIP = '#000000';
const GOLD = '#c99414';
const GOLD_DEEP = '#775400';
const WHITE = '#fafafa';
const MUTED = '#a3a3a3';
const PAD = 84;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A card on its lip, as the quiz draws its cards and buttons. */
function raisedCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, border: string, lip: string) {
  roundRect(ctx, x, y + 10, w, h, 40);
  ctx.fillStyle = lip;
  ctx.fill();
  roundRect(ctx, x, y, w, h, 40);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = border;
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
  ctx.textBaseline = 'alphabetic';

  // The ground, with the gold glow the medal sits in.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, RESULT_CARD.height);
  const glow = ctx.createRadialGradient(W / 2, 560, 40, W / 2, 560, 720);
  glow.addColorStop(0, 'rgba(201, 148, 20, 0.28)');
  glow.addColorStop(1, 'rgba(201, 148, 20, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 1300);

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
  const cx = W / 2;
  const cy = 520;
  const r = 190;
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
  let placeSize = 170;
  while (placeSize > 90 && measureDisplay(copy.place, placeSize) > r * 1.6) placeSize -= 6;
  ctx.font = display(placeSize);
  ctx.fillText(copy.place, cx, cy + placeSize * 0.36);

  // Who, and in what.
  let y = 820;
  const nameFit = fitText(input.playerName, { width: W - PAD * 2, maxLines: 2, max: 92, min: 56, step: 4 }, measureDisplay);
  ctx.font = display(nameFit.size);
  ctx.fillStyle = WHITE;
  for (const line of nameFit.lines) {
    y += nameFit.size * 1.05;
    ctx.fillText(line, cx, y);
  }
  y += 70;
  ctx.font = body(42, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(`came ${copy.place} in`, cx, y);
  const titleFit = fitText(input.quizTitle, { width: W - PAD * 2, maxLines: 3, max: 72, min: 44, step: 4 }, measureDisplay);
  ctx.font = display(titleFit.size);
  ctx.fillStyle = GOLD;
  for (const line of titleFit.lines) {
    y += titleFit.size * 1.12;
    ctx.fillText(line, cx, y);
  }

  // The points, as a raised pill.
  y += 60;
  const points = pointsText(input.score);
  ctx.font = display(64);
  const pillW = ctx.measureText(points).width + 112;
  raisedCard(ctx, cx - pillW / 2, y, pillW, 120, CARD, CARD_BORDER, LIP);
  ctx.fillStyle = WHITE;
  ctx.fillText(points, cx, y + 84);
  y += 120 + 64;
  ctx.font = body(36, 500);
  ctx.fillStyle = MUTED;
  ctx.fillText(trimToWidth(ctx, copy.meta, W - PAD * 2), cx, y);

  // The top three, the player's own row lit.
  const rows = input.podium.slice(0, 3);
  if (rows.length > 0) {
    const rowH = 112;
    const boxH = rows.length * rowH + 48;
    const boxY = Math.max(y + 64, 1760 - 96 - boxH);
    raisedCard(ctx, PAD, boxY, W - PAD * 2, boxH, CARD, CARD_BORDER, LIP);
    rows.forEach((row, i) => {
      const ry = boxY + 24 + i * rowH;
      if (row.isViewer) {
        roundRect(ctx, PAD + 16, ry + 8, W - PAD * 2 - 32, rowH - 16, 28);
        ctx.fillStyle = 'rgba(201, 148, 20, 0.18)';
        ctx.fill();
      }
      // The rank in a gold disc for first, an outlined one after.
      const dx = PAD + 80;
      const dy = ry + rowH / 2;
      ctx.beginPath();
      ctx.arc(dx, dy, 32, 0, Math.PI * 2);
      if (row.rank === 1) {
        ctx.fillStyle = GOLD;
        ctx.fill();
      } else {
        ctx.lineWidth = 4;
        ctx.strokeStyle = CARD_BORDER;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.font = display(34);
      ctx.fillStyle = row.rank === 1 ? INK : WHITE;
      ctx.fillText(String(row.rank), dx, dy + 12);
      ctx.textAlign = 'right';
      ctx.font = display(38);
      ctx.fillStyle = row.isViewer ? GOLD : WHITE;
      const score = pointsText(row.score);
      ctx.fillText(score, W - PAD - 48, dy + 13);
      const scoreW = ctx.measureText(score).width;
      ctx.textAlign = 'left';
      ctx.font = body(38, row.isViewer ? 700 : 500);
      ctx.fillStyle = WHITE;
      ctx.fillText(trimToWidth(ctx, row.name, W - PAD * 2 - 48 - 136 - scoreW - 32), dx + 56, dy + 13);
    });
  }

  // Where to play.
  ctx.textAlign = 'center';
  ctx.font = body(32, 700);
  ctx.fillStyle = MUTED;
  ctx.fillText('Play live quizzes with your class on lawexa.com', cx, 1840);
}
