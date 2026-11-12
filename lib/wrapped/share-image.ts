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

/**
 * What a poster says, in Arthur's Wrapped layout. Wrapped fills it from a
 * student's record (`wrappedPoster`); the live quiz fills it from a player's
 * result (`v2/features/channels/quiz/result-card.ts`, Arthur, f730f71c: "a
 * shareable card just like we did for the Wrapped"). One layout, one drawing.
 */
export interface PosterContent {
  /** The ground under Arthur's frame, shown alone when the frame cannot load. */
  background: string;
  /** The tracked kicker over the line ("MY POST-BAR FINALS VIBE:"). */
  kicker: string;
  /** The display line above the polaroid. */
  line: string;
  /** On the polaroid's white edge: who, and the line under it. */
  caption: { name: string; sub: string | null };
  /** In the polaroid's circle when there is neither a photo nor a face ("2nd"). */
  mark?: string;
  /** The turned sticker on the polaroid's corner (the persona). */
  banner: string;
  /** At most three stat stickers. */
  stickers: { value: string; label: string }[];
  /** The campaign line beside the stickers; the last part is highlighted. */
  campaign: readonly string[];
  /** Beside the mark at the foot ("GET YOURS · LAWEXA.COM/WRAPPED"). */
  link: string;
}

/** A student's Wrapped poster: their vibe, face card, stickers and persona. */
export function wrappedPoster(record: WrappedRecord): PosterContent {
  const vibe = vibeFor(record.vibe.id);
  return {
    background: VIBE_BACKGROUNDS[vibe.colour],
    kicker: 'MY POST-BAR FINALS VIBE:',
    line: vibe.line,
    caption: {
      name: shareName(record.student.first_name, record.student.last_initial),
      sub: record.student.campus ? `${CAMPUS_NAMES[record.student.campus]} Campus` : null,
    },
    banner: PERSONAS[record.persona.key]?.name ?? PERSONAS.steady_learned_friend.name,
    stickers: shownStickers(record.stickers).map(stickerText),
    campaign: CAMPAIGN_LINE,
    link: `GET YOURS · ${WRAPPED_URL.toUpperCase()}`,
  };
}

export function drawShareCard(canvas: HTMLCanvasElement, record: WrappedRecord, fonts: ShareFonts, art: ShareArt): void {
  drawPoster(canvas, wrappedPoster(record), fonts, art);
}

export function drawPoster(canvas: HTMLCanvasElement, content: PosterContent, fonts: ShareFonts, art: ShareArt): void {
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ink = WRAPPED_COLOURS.ink;
  const display = (size: number) => `900 ${size}px ${fonts.display}`;
  const body = (size: number, weight = 500) => `${weight} ${size}px ${fonts.body}`;
  const measureDisplay: Measure = (text, size) => {
    ctx.font = display(size);
    return ctx.measureText(text).width;
  };
  const L = SHARE_LAYOUT;
  // The sticker on the polaroid's corner, measured first: the caption's second line stops short of it.
  const banner = personaBanner(content.banner, measureDisplay);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Arthur's frame; without it (offline), the card's colour, so the words still read.
  ctx.fillStyle = content.background;
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
  } else if (content.mark) {
    // No picture to show: the mark in the frame's circle, in the display type.
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    let size = 200;
    while (size > 80 && measureDisplay(content.mark, size) > POLAROID.circle.r * 1.6) size -= 8;
    ctx.font = display(size);
    ctx.fillText(content.mark, POLAROID.circle.cx, POLAROID.circle.cy + size * 0.36);
    ctx.textAlign = 'left';
  }
  if (art.prop) {
    const [px, py, pw, ph] = POLAROID.prop;
    ctx.drawImage(art.prop, px, py, pw, ph);
  }
  // The caption: who, on the polaroid's white edge.
  const [cx, cy, cw] = POLAROID.caption;
  ctx.fillStyle = ink;
  ctx.font = body(40, 700);
  ctx.fillText(content.caption.name, cx, cy + 62, cw * 0.62);
  if (content.caption.sub) {
    const measureBody: Measure = (text, size) => {
      ctx.font = body(size, 500);
      return ctx.measureText(text).width;
    };
    const sub = captionSubFit(content.caption.sub, measureBody, captionSubRoom(banner));
    ctx.fillStyle = WRAPPED_COLOURS.inkMuted;
    ctx.font = body(sub.size, 500);
    ctx.fillText(sub.text, cx, cy + 106);
  }
  ctx.restore();

  // The vibe line, above the polaroid.
  ctx.fillStyle = ink;
  ctx.font = body(28, 700);
  trackedText(ctx, content.kicker, L.top.x, L.top.kickerY, 8, L.top.width);
  const line = posterLine(content.line, measureDisplay);
  ctx.font = display(line.size);
  let y = L.top.lineTop;
  for (const text of line.lines) {
    y += line.size * 0.95;
    ctx.fillText(text, L.top.x, y);
  }

  // Three stat stickers (square, outlined, the raised surface) and the campaign line beside them.
  content.stickers.slice(0, 3).forEach(({ value, label }, i) => {
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
  const widest = Math.max(...content.campaign.map((text) => measureDisplay(text, campaignSize)));
  while (campaignSize > 30 && widest * (campaignSize / 52) + 24 > campaignW) campaignSize -= 2;
  content.campaign.forEach((text, i) => {
    const ty = L.bottom.y + 62 + i * (L.bottom.stickerH + L.bottom.gap);
    ctx.font = display(campaignSize);
    if (i === content.campaign.length - 1) {
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
  trackedText(ctx, content.link, L.link.x, L.link.y, 2, SHARE_WIDTH - L.link.x - PAD);
}

/** The caption's lines never run wider than this on the polaroid's white edge. */
export const CAPTION_SUB_WIDTH = POLAROID.caption[2] * 0.62;

/** The gap the caption's second line keeps before the sticker on the polaroid's corner. */
const CAPTION_STICKER_GAP = 12;

/**
 * How wide the caption's second line may run: its usual width, or less when
 * the sticker on the polaroid's corner (`banner`) starts sooner, so the line
 * never runs under it (a university's name did; pictures of 4a612ab6). The
 * sticker is measured where it is drawn; its slight turn is within the gap.
 */
export function captionSubRoom(banner: PersonaBanner): number {
  const stickerLeft = banner.cx - banner.w / 2;
  return Math.min(CAPTION_SUB_WIDTH, stickerLeft - POLAROID.caption[0] - CAPTION_STICKER_GAP);
}

/**
 * The caption's second line (a campus, a university): 30 px when it fits the
 * room, a size down to 22 px when it does not, and past that the line ends
 * with "…". Never squeezed by fillText's maxWidth (a long university's name
 * came out at two thirds of its width; techlead's review of 4a612ab6). Pure,
 * so a test pins it.
 */
export function captionSubFit(text: string, measure: Measure, room: number = CAPTION_SUB_WIDTH): { size: number; text: string } {
  for (let size = 30; size >= 22; size -= 2) {
    if (measure(text, size) <= room) return { size, text };
  }
  let cut = text;
  while (cut.length > 1 && measure(`${cut.trimEnd()}…`, 22) > room) cut = cut.slice(0, -1);
  return { size: 22, text: `${cut.trimEnd()}…` };
}

/**
 * The display line's type and wrapping above the polaroid: two lines from 96
 * px down to 52, or three from 64 down to 46 when two will not fit the band.
 * Pure, so a test pins it with the longest quiz titles.
 */
export function posterLine(text: string, measure: Measure): { size: number; lines: string[] } {
  const L = SHARE_LAYOUT;
  const room = L.top.lineBottom - L.top.lineTop;
  let line = fitText(text, { width: L.top.width, maxLines: 2, max: 96, min: 52, step: 2 }, measure);
  if (line.lines.length * line.size * 0.95 > room || line.lines.length > 2) {
    line = fitText(text, { width: L.top.width, maxLines: 3, max: 64, min: 46, step: 2 }, measure);
  }
  if (line.lines.length <= 3) return line;
  // Past three lines at the smallest size (a long quiz title; Wrapped's vibe
  // lines never are): the first three, the last ending with "…".
  const kept = line.lines.slice(0, 3);
  let last = `${kept[2]} ${line.lines.slice(3).join(' ')}`;
  while (last.length > 1 && measure(`${last}…`, line.size) > L.top.width) last = last.slice(0, -1);
  kept[2] = `${last.trimEnd()}…`;
  return { size: line.size, lines: kept };
}
