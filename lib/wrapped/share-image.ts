import { CAMPAIGN_LINE, CAMPUS_NAMES, PERSONAS, STICKER_LABELS, WRAPPED_URL, formatCount, shareName, vibeFor } from './copy';
import { fitText, type Measure } from '@/lib/share-card/text-fit';
import { POLAROID, SHARE_HEIGHT, SHARE_WIDTH, STROKE_OUTLINE, VIBE_BACKGROUNDS, WRAPPED_COLOURS } from './theme';
import type { WrappedRecord, WrappedSticker } from './types';

/**
 * The share card as a 1080 × 1920 PNG, drawn on the phone (the techlead's
 * brief, 4 November: no server rendering). It is only the poster: the vibe
 * line, the face card, three stat stickers, the persona, the campaign line and
 * "Get yours · lawexa.com/wrapped", with the background running to the bottom
 * edge. The share bar is app UI and never in the image. Drawn straight onto a
 * canvas rather than captured from the page, so the PNG is the same on every
 * phone, whatever the screen's size or zoom.
 *
 * Arthur's art (frame, face, prop for each vibe) and the student's photo are
 * loaded by the caller; a picture that does not load is left out, never
 * replaced by a made-up one.
 */

export interface ShareFonts {
  /** The CSS family names next/font gave Unbounded and Inter. */
  display: string;
  body: string;
}

const PAD = 84;

/**
 * The stat stickers the card shows: at most three, leaving out any whose
 * number is 0, so a quiet student's card never says "0 overnights". Pure, so
 * a test pins it.
 */
export function shownStickers(stickers: readonly WrappedSticker[]): WrappedSticker[] {
  return stickers.filter((sticker) => !(typeof sticker.value === 'number' ? sticker.value === 0 : /^\s*0+(\.0+)?\s*$/.test(sticker.value))).slice(0, 3);
}

function stickerText(sticker: WrappedSticker): { value: string; label: string } {
  const value = typeof sticker.value === 'number' ? formatCount(sticker.value) : String(sticker.value);
  return { value, label: STICKER_LABELS[sticker.key] ?? '' };
}

/** The photo, cropped to cover the box. */
function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
}

/**
 * The student's photo URL for the canvas, with `wr=1` added. The avatar shows
 * elsewhere in the app without CORS, and the browser may reuse that cached
 * copy, which has no CORS headers and fails a crossOrigin load. A distinct URL
 * makes the browser ask the storage again, with CORS.
 */
export function corsPhotoUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, 'https://lawexa.com');
    parsed.searchParams.set('wr', '1');
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Where the live words sit on Arthur's share-card frame (handoff manifest, 4
 * November 2026). The frame brings the background, the pattern, the scribbles,
 * the polaroid and the Lawexa mark; the app adds the vibe line in the band
 * above the polaroid, the three stickers and the campaign line in the band
 * below it, the persona as a sticker on the polaroid's corner, the name in the
 * polaroid's caption, and the link beside the mark. Pure, so a test pins it.
 */
export const SHARE_LAYOUT = {
  /** The band between the top scribble and the polaroid. */
  top: { x: PAD, kickerY: 330, lineTop: 352, lineBottom: 528, width: SHARE_WIDTH - PAD * 2 },
  /** The band between the polaroid and the bottom scribble. */
  bottom: { x: PAD, y: 1372, stickerW: 560, stickerH: 88, gap: 12 },
  persona: { x: 586, y: 1248, h: 92, maxW: 430, rotationDeg: 4, pad: 28, edge: 48 },
  /** Beside Arthur's Lawexa mark (an ink disc, 64 px from the bottom and left). */
  link: { x: 186, y: 1822 },
} as const;

function trackedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, maxWidth?: number) {
  // letterSpacing is in Chrome, Edge and Safari 17+; elsewhere the text is drawn untracked.
  const withSpacing = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const before = withSpacing.letterSpacing;
  if (before !== undefined) withSpacing.letterSpacing = `${spacing}px`;
  if (maxWidth) ctx.fillText(text, x, y, maxWidth);
  else ctx.fillText(text, x, y);
  if (before !== undefined) withSpacing.letterSpacing = before;
}

const PERSONA_LEADING = 1.1;

export interface PersonaBanner {
  size: number;
  lines: string[];
  /** The banner's width and height before it is turned, and its centre. */
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** The right-most point of the turned banner. */
  right: number;
}

/**
 * The persona sticker's type and place (Techlead 61f7c6f8). One line from 40 px
 * down to 32 px; a name too long for that ("The Steady Learned Friend", the
 * default persona) takes two lines, growing upward so the stickers below stay
 * clear. The banner keeps its corner of the polaroid and moves left only as far
 * as it must to leave `edge` px before the card's right edge, once turned.
 */
export function personaBanner(name: string, measure: Measure): PersonaBanner {
  const P = SHARE_LAYOUT.persona;
  const room = P.maxW - P.pad * 2;
  const one = fitText(name, { width: room, maxLines: 1, max: 40, min: 32, step: 2 }, measure);
  const fits = one.lines.length === 1 && measure(one.lines[0], one.size) <= room;
  const fitted = fits ? one : fitText(name, { width: room, maxLines: 2, max: 40, min: 26, step: 2 }, measure);
  const textW = Math.max(...fitted.lines.map((line) => measure(line, fitted.size)));
  const w = Math.min(textW, room) + P.pad * 2;
  const h = Math.max(P.h, Math.round(fitted.lines.length * fitted.size * PERSONA_LEADING + 48));
  const turn = (P.rotationDeg * Math.PI) / 180;
  const half = (w * Math.cos(turn) + h * Math.sin(turn)) / 2;
  const cx = Math.min(P.x + w / 2, SHARE_WIDTH - P.edge - half);
  const cy = P.y + P.h - h / 2;
  return { size: fitted.size, lines: fitted.lines, w, h, cx, cy, right: cx + half };
}

export interface ShareArt {
  frame: HTMLImageElement | null;
  face: HTMLImageElement | null;
  prop: HTMLImageElement | null;
  photo: HTMLImageElement | null;
}

export function drawShareCard(canvas: HTMLCanvasElement, record: WrappedRecord, fonts: ShareFonts, art: ShareArt): void {
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const vibe = vibeFor(record.vibe.id);
  const ink = WRAPPED_COLOURS.ink;
  const display = (size: number) => `900 ${size}px ${fonts.display}`;
  const body = (size: number, weight = 500) => `${weight} ${size}px ${fonts.body}`;
  const measureDisplay: Measure = (text, size) => {
    ctx.font = display(size);
    return ctx.measureText(text).width;
  };
  const L = SHARE_LAYOUT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Arthur's frame; without it (offline), the card's colour, so the words still read.
  ctx.fillStyle = VIBE_BACKGROUNDS[vibe.colour];
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  if (art.frame) ctx.drawImage(art.frame, 0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  // In the polaroid, turned with it: the photo in the circle, else the face; the prop across the top.
  ctx.save();
  ctx.translate(POLAROID.origin[0], POLAROID.origin[1]);
  ctx.rotate((POLAROID.rotationDeg * Math.PI) / 180);
  ctx.translate(-POLAROID.origin[0], -POLAROID.origin[1]);
  const [wx, wy, ww, wh] = POLAROID.window;
  if (art.photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(POLAROID.circle.cx, POLAROID.circle.cy, POLAROID.circle.r, 0, Math.PI * 2);
    ctx.clip();
    const r = POLAROID.circle.r;
    drawCover(ctx, art.photo, POLAROID.circle.cx - r, POLAROID.circle.cy - r, r * 2, r * 2);
    ctx.restore();
  } else if (art.face) {
    ctx.drawImage(art.face, wx, wy, ww, wh);
  }
  if (art.prop) {
    const [px, py, pw, ph] = POLAROID.prop;
    ctx.drawImage(art.prop, px, py, pw, ph);
  }
  // The caption: who, on the polaroid's white edge.
  const [cx, cy, cw] = POLAROID.caption;
  ctx.fillStyle = ink;
  ctx.font = body(40, 700);
  ctx.fillText(shareName(record.student.first_name, record.student.last_initial), cx, cy + 62, cw * 0.62);
  if (record.student.campus) {
    ctx.fillStyle = WRAPPED_COLOURS.inkMuted;
    ctx.font = body(30, 500);
    ctx.fillText(`${CAMPUS_NAMES[record.student.campus]} Campus`, cx, cy + 106, cw * 0.62);
  }
  ctx.restore();

  // The vibe line, above the polaroid.
  ctx.fillStyle = ink;
  ctx.font = body(28, 700);
  trackedText(ctx, 'MY POST-BAR FINALS VIBE:', L.top.x, L.top.kickerY, 8);
  const room = L.top.lineBottom - L.top.lineTop;
  let line = fitText(vibe.line, { width: L.top.width, maxLines: 2, max: 96, min: 52, step: 2 }, measureDisplay);
  if (line.lines.length * line.size * 0.95 > room || line.lines.length > 2) {
    line = fitText(vibe.line, { width: L.top.width, maxLines: 3, max: 64, min: 46, step: 2 }, measureDisplay);
  }
  ctx.font = display(line.size);
  let y = L.top.lineTop;
  for (const text of line.lines) {
    y += line.size * 0.95;
    ctx.fillText(text, L.top.x, y);
  }

  // Three stat stickers (square, outlined, the raised surface) and the campaign line beside them.
  shownStickers(record.stickers).forEach((sticker, i) => {
    const { value, label } = stickerText(sticker);
    const sx = L.bottom.x;
    const sy = L.bottom.y + i * (L.bottom.stickerH + L.bottom.gap);
    ctx.fillStyle = WRAPPED_COLOURS.white;
    ctx.fillRect(sx, sy, L.bottom.stickerW, L.bottom.stickerH);
    ctx.lineWidth = STROKE_OUTLINE;
    ctx.strokeStyle = ink;
    ctx.strokeRect(sx, sy, L.bottom.stickerW, L.bottom.stickerH);
    ctx.fillStyle = ink;
    ctx.font = body(56, 700);
    ctx.fillText(value, sx + 24, sy + 64, 230);
    const valueW = Math.min(230, ctx.measureText(value).width);
    ctx.font = body(30, 500);
    ctx.fillText(label, sx + 24 + valueW + 16, sy + 58, L.bottom.stickerW - valueW - 64);
  });
  const campaignX = L.bottom.x + L.bottom.stickerW + 36;
  const campaignW = SHARE_WIDTH - PAD - campaignX;
  let campaignSize = 52;
  while (campaignSize > 30 && measureDisplay(CAMPAIGN_LINE[2], campaignSize) + 24 > campaignW) campaignSize -= 2;
  CAMPAIGN_LINE.forEach((text, i) => {
    const ty = L.bottom.y + 62 + i * (L.bottom.stickerH + L.bottom.gap);
    ctx.font = display(campaignSize);
    if (i === CAMPAIGN_LINE.length - 1) {
      // "The Bench." is highlighted (spec): ink block, cream type, square as the system is.
      ctx.fillStyle = ink;
      ctx.fillRect(campaignX, ty - campaignSize, measureDisplay(text, campaignSize) + 24, campaignSize * 1.34);
      ctx.fillStyle = WRAPPED_COLOURS.cream;
      ctx.font = display(campaignSize);
      ctx.fillText(text, campaignX + 12, ty);
    } else {
      ctx.fillStyle = ink;
      ctx.fillText(text, campaignX + 12, ty);
    }
  });

  // The persona, as a sticker on the polaroid's lower right corner.
  const persona = PERSONAS[record.persona.key]?.name ?? PERSONAS.steady_learned_friend.name;
  const banner = personaBanner(persona, measureDisplay);
  ctx.save();
  ctx.translate(banner.cx, banner.cy);
  ctx.rotate((L.persona.rotationDeg * Math.PI) / 180);
  ctx.fillStyle = ink;
  ctx.fillRect(-banner.w / 2, -banner.h / 2, banner.w, banner.h);
  ctx.fillStyle = WRAPPED_COLOURS.gold;
  ctx.font = display(banner.size);
  ctx.textAlign = 'center';
  banner.lines.forEach((text, i) => {
    ctx.fillText(text, 0, banner.size * 0.36 + (i - (banner.lines.length - 1) / 2) * banner.size * PERSONA_LEADING, banner.w - L.persona.pad * 2);
  });
  ctx.restore();

  // Where to get one, beside the mark.
  ctx.fillStyle = ink;
  ctx.font = body(34, 700);
  trackedText(ctx, `GET YOURS · ${WRAPPED_URL.toUpperCase()}`, L.link.x, L.link.y, 2, SHARE_WIDTH - L.link.x - PAD);
}
