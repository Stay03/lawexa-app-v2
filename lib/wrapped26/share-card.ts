import { fitText, wrapWords, type Measure } from '@/lib/wrapped/text-fit';
import type { Wrapped26Character } from './characters';
import type { Wrapped26CardFormat } from './progress';
import type { Wrapped26Record } from './types';

/**
 * Wrapped 2026's share cards, drawn on the phone (Techlead's call, 21
 * November 2026: no server rendering), from the kit's share-card-renderer
 * templates (poster.py: share_story, share_square, share_landscape). A canvas
 * of a fixed size with the loaded fonts, so every phone makes the same PNG.
 * Content (BUILD_SPEC §6): avatar, first name, "as {character}", the show
 * credit, the character line, two headline stats, the archetype and
 * LAWEXA.COM/WRAPPED. Text only for characters: no stills or likenesses.
 */

export const CARD_SIZES: Record<Wrapped26CardFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1200, height: 627 },
};

const C = {
  ink: '#171307',
  cream: '#f3ecd9',
  ink300: '#9b9485',
  gold: '#d3af37',
  lilac: '#9591f8',
  coral: '#e55541',
  lime: '#bee860',
} as const;

export interface CardFonts {
  display: string;
  body: string;
}

/** What a card says, from the record and the cast; pure, so a test pins it. */
export interface CardContent {
  firstName: string;
  initial: string;
  /** "Student" or "Counsel", the chrome's tag. */
  label: string;
  character: string;
  show: string | null;
  line: string | null;
  archetype: string;
  accent: string;
  stats: [{ value: string; label: string }, { value: string; label: string }];
}

export function cardContent(record: Wrapped26Record, character: Wrapped26Character | null): CardContent {
  const student = record.track === 'undergraduates';
  const [first, second] = record.shareStats;
  return {
    firstName: record.user.firstName,
    initial: record.user.firstName.slice(0, 1).toUpperCase(),
    label: student ? 'Student' : 'Counsel',
    character: record.character.name,
    show: character?.show ?? null,
    line: character ? (student ? character.studentLine : character.line) : null,
    archetype: record.character.archetype,
    accent: C[character?.accent ?? 'gold'],
    stats: [first ?? { value: '', label: '' }, second ?? { value: '', label: '' }],
  };
}

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

function font(ctx: Ctx, weight: number, size: number, family: string, spacing = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${spacing}px`;
}

function measureWith(ctx: Ctx, weight: number, family: string, spacing = 0): Measure {
  return (text, size) => {
    font(ctx, weight, size, family, spacing);
    return ctx.measureText(text).width;
  };
}

/** One line of display type, as large as fits `width`, up to `max`. Returns its size. */
function displayLine(ctx: Ctx, text: string, x: number, baseline: number, width: number, max: number, family: string, colour: string, spacing: number): number {
  const measure = measureWith(ctx, 900, family, spacing);
  let size = max;
  while (size > 12 && measure(text, size) > width) size -= 2;
  font(ctx, 900, size, family, spacing);
  ctx.fillStyle = colour;
  ctx.fillText(text, x, baseline);
  return size;
}

function tracked(ctx: Ctx, text: string, x: number, y: number, weight: number, size: number, family: string, spacing: number, colour: string, align: CanvasTextAlign = 'left') {
  font(ctx, weight, size, family, spacing);
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
  ctx.textAlign = 'left';
}

/** The pill tag ("STUDENT") with its right edge at `right`. */
function tag(ctx: Ctx, text: string, right: number, top: number, size: number, spacing: number, padX: number, padY: number, fonts: CardFonts, accent: string) {
  font(ctx, 700, size, fonts.body, spacing);
  const label = text.toUpperCase();
  const w = ctx.measureText(label).width + padX * 2;
  const h = size + padY * 2;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(right - w, top, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, right - w + padX, top + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

/** The avatar: photo (cover) or initial on cream, ringed in the accent, with the offset accent shadow. */
function avatar(ctx: Ctx, x: number, y: number, size: number, content: CardContent, photo: HTMLImageElement | null, fonts: CardFonts) {
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  const ring = Math.max(6, Math.floor(size / 28));
  const halo = Math.max(4, Math.floor(size / 45));
  const offset = Math.max(10, Math.floor(size / 20));
  // The offset shadow: an accent disc, ringed in ink, behind and down-right.
  ctx.fillStyle = content.accent;
  ctx.beginPath();
  ctx.arc(cx + offset, cy + offset, r + halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, r + halo, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = content.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  const inner = r - ring;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = C.cream;
  ctx.fillRect(cx - inner, cy - inner, inner * 2, inner * 2);
  if (photo) {
    const scale = Math.max((inner * 2) / photo.width, (inner * 2) / photo.height);
    const sw = (inner * 2) / scale;
    const sh = (inner * 2) / scale;
    ctx.drawImage(photo, (photo.width - sw) / 2, (photo.height - sh) / 2, sw, sh, cx - inner, cy - inner, inner * 2, inner * 2);
  } else {
    font(ctx, 900, Math.floor(size * 0.45), fonts.display);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(content.initial, cx, cy + size * 0.03);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

/** "FROM SHOW (YEAR)": the muted word, the show in cream. */
function credit(ctx: Ctx, show: string | null, x: number, y: number, size: number, fonts: CardFonts) {
  if (!show) return;
  const spacing = Math.max(2, Math.floor(size / 8));
  tracked(ctx, 'FROM ', x, y, 700, size, fonts.body, spacing, C.ink300);
  const w = ctx.measureText('FROM ').width;
  tracked(ctx, show.toUpperCase(), x + w, y, 700, size, fonts.body, spacing, C.cream);
}

/** Body text wrapped into `width`, top at `top`; returns the bottom. */
function paragraph(ctx: Ctx, text: string | null, x: number, top: number, width: number, size: number, leading: number, fonts: CardFonts, maxLines: number): number {
  if (!text) return top;
  const measure = measureWith(ctx, 700, fonts.body, -1);
  const fitted = fitText(text, { width, maxLines, max: size, min: Math.round(size * 0.7), step: 2 }, measure);
  const lines = fitted.lines.length <= maxLines ? fitted.lines : wrapWords(text, fitted.size, width, measure).slice(0, maxLines);
  font(ctx, 700, fitted.size, fonts.body, -1);
  ctx.fillStyle = C.cream;
  lines.forEach((line, i) => ctx.fillText(line, x, top + fitted.size + i * fitted.size * leading));
  return top + lines.length * fitted.size * leading;
}

function frame(ctx: Ctx, width: number, height: number, inset: number, accent: string) {
  ctx.fillStyle = C.ink;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(inset + 2, inset + 2, width - inset * 2 - 4, height - inset * 2 - 4);
}

function rule(ctx: Ctx, x0: number, x1: number, y: number) {
  ctx.fillStyle = C.cream;
  ctx.fillRect(x0, y, x1 - x0, 4);
}

/** A headline stat in Inter (the kit's .stat), its label under it; returns the wider of the two. */
function stat(ctx: Ctx, value: string, label: string, x: number, valueBaseline: number, valueSize: number, labelSize: number, labelGap: number, fonts: CardFonts, width: number): number {
  const measure = measureWith(ctx, 500, fonts.body, -2);
  let size = valueSize;
  while (size > 12 && measure(value, size) > width) size -= 2;
  font(ctx, 500, size, fonts.body, -2);
  ctx.fillStyle = C.cream;
  ctx.fillText(value, x, valueBaseline);
  const valueW = ctx.measureText(value).width;
  tracked(ctx, label, x, valueBaseline + labelGap + labelSize, 700, labelSize, fonts.body, 0, C.ink300);
  return Math.max(valueW, ctx.measureText(label).width);
}

function drawStory(ctx: Ctx, c: CardContent, photo: HTMLImageElement | null, fonts: CardFonts) {
  const W = 1080;
  const H = 1920;
  frame(ctx, W, H, 48, c.accent);
  const left = 48 + 4 + 48;
  const right = W - left;
  tracked(ctx, 'LAWEXA WRAPPED 2026', left, 48 + 4 + 56 + 26, 700, 22, fonts.body, 7, C.cream);
  tag(ctx, c.label, right, 48 + 4 + 56, 20, 6, 20, 10, fonts, c.accent);
  const avatarTop = 48 + 4 + 56 + 40 + 72;
  avatar(ctx, left, avatarTop, 460, c, photo, fonts);
  const nameBase = avatarTop + 460 + 64 + 190;
  displayLine(ctx, c.firstName, left, nameBase, 880, 210, fonts.display, C.cream, -3);
  const asBase = nameBase + 24 + 80;
  font(ctx, 700, 48, fonts.display);
  ctx.fillStyle = c.accent;
  ctx.fillText('as', left, asBase);
  const asW = ctx.measureText('as').width + 20;
  displayLine(ctx, c.character, left + asW, asBase, right - left - asW, 88, fonts.display, c.accent, -2);
  credit(ctx, c.show, left, asBase + 16 + 26, 22, fonts);
  paragraph(ctx, c.line, left, asBase + 16 + 26 + 36, right - left, 40, 1.25, fonts, 3);
  // Two stats over a rule, split by a vertical rule; then the archetype and the link.
  const footBase = H - 48 - 4 - 56 - 6;
  const statsTop = footBase - 40 - 26 - 8 - 30 - 76 - 32;
  rule(ctx, left, right, statsTop);
  const half = (right - left) / 2;
  ctx.fillRect(left + half - 2, statsTop, 4, footBase - 40 - 22 - statsTop);
  stat(ctx, c.stats[0].value, c.stats[0].label, left, statsTop + 32 + 70, 76, 30, 8, fonts, half - 20);
  stat(ctx, c.stats[1].value, c.stats[1].label, left + half + 32, statsTop + 32 + 70, 76, 30, 8, fonts, half - 32);
  tracked(ctx, 'ARCHETYPE ', left, footBase, 700, 22, fonts.body, 3, C.ink300);
  const aw = ctx.measureText('ARCHETYPE ').width;
  tracked(ctx, c.archetype.toUpperCase(), left + aw, footBase, 700, 22, fonts.body, 3, C.cream);
  tracked(ctx, 'LAWEXA.COM/WRAPPED', right, footBase, 700, 26, fonts.body, 2, C.cream, 'right');
}

function drawSquare(ctx: Ctx, c: CardContent, photo: HTMLImageElement | null, fonts: CardFonts) {
  const W = 1080;
  const H = 1080;
  frame(ctx, W, H, 40, c.accent);
  const left = 40 + 4 + 48;
  const right = W - left;
  tracked(ctx, 'LAWEXA WRAPPED 2026', left, 40 + 4 + 48 + 20, 700, 18, fonts.body, 6, C.cream);
  tag(ctx, c.label, right, 40 + 4 + 48 - 2, 16, 4, 14, 6, fonts, c.accent);
  const rowTop = 40 + 4 + 48 + 28 + 48;
  avatar(ctx, left, rowTop, 300, c, photo, fonts);
  const textLeft = left + 300 + 48;
  const textW = right - textLeft;
  const nameBase = rowTop + 30 + 135;
  displayLine(ctx, c.firstName, textLeft, nameBase, Math.min(560, textW), 150, fonts.display, C.cream, -3);
  const asBase = nameBase + 20 + 54;
  font(ctx, 700, 32, fonts.display);
  ctx.fillStyle = c.accent;
  ctx.fillText('as', textLeft, asBase);
  const asW = ctx.measureText('as').width + 14;
  displayLine(ctx, c.character, textLeft + asW, asBase, Math.min(500, textW - asW), 60, fonts.display, c.accent, -1.5);
  credit(ctx, c.show, textLeft, asBase + 12 + 18, 16, fonts);
  paragraph(ctx, c.line, left, rowTop + 300 + 44, right - left, 30, 1.3, fonts, 2);
  const urlBase = H - 40 - 4 - 48 - 4;
  const statsBottom = urlBase - 24 - 20;
  const statsTop = statsBottom - 26 - 8 - 120 - 24;
  rule(ctx, left, right, statsTop);
  const half = (right - left) / 2;
  const firstW = stat(ctx, c.stats[0].value, c.stats[0].label, left, statsTop + 24 + 108, 120, 26, 8, fonts, half - 24);
  const secondX = left + Math.min(firstW, half) + 48;
  stat(ctx, c.stats[1].value, c.stats[1].label, secondX, statsTop + 24 + 108, 120, 26, 8, fonts, right - secondX);
  tracked(ctx, 'LAWEXA.COM/WRAPPED', left, urlBase, 700, 20, fonts.body, 2, C.cream);
}

function drawLandscape(ctx: Ctx, c: CardContent, photo: HTMLImageElement | null, fonts: CardFonts) {
  const W = 1200;
  const H = 627;
  frame(ctx, W, H, 24, c.accent);
  const left = 24 + 4 + 44;
  const top = 24 + 4 + 36;
  const bottom = H - top;
  avatar(ctx, left, (H - 300) / 2, 300, c, photo, fonts);
  const textLeft = left + 300 + 44;
  const right = W - 24 - 4 - 44;
  const textW = right - textLeft;
  tracked(ctx, 'LAWEXA WRAPPED 2026', textLeft, top + 18, 700, 14, fonts.body, 5, C.cream);
  tag(ctx, c.label, right, top, 14, 4, 12, 6, fonts, c.accent);
  const nameBase = top + 26 + 22 + 98;
  displayLine(ctx, c.firstName, textLeft, nameBase, Math.min(700, textW), 110, fonts.display, C.cream, -3);
  const asBase = nameBase + 12 + 44;
  font(ctx, 700, 26, fonts.display);
  ctx.fillStyle = c.accent;
  ctx.fillText('as', textLeft, asBase);
  const asW = ctx.measureText('as').width + 12;
  displayLine(ctx, c.character, textLeft + asW, asBase, Math.min(640, textW - asW), 48, fonts.display, c.accent, -1);
  credit(ctx, c.show, textLeft, asBase + 8 + 14, 14, fonts);
  paragraph(ctx, c.line, textLeft, asBase + 8 + 14 + 10, textW, 20, 1.3, fonts, 2);
  const labelBase = bottom - 2;
  const valueBase = labelBase - 15 - 8;
  rule(ctx, textLeft, right, valueBase - 38 - 12);
  const firstW = stat(ctx, c.stats[0].value, c.stats[0].label, textLeft, valueBase, 38, 15, 4, fonts, 240);
  stat(ctx, c.stats[1].value, c.stats[1].label, textLeft + Math.min(260, firstW) + 28, valueBase, 38, 15, 4, fonts, 240);
  tracked(ctx, 'LAWEXA.COM/WRAPPED', right, labelBase, 700, 15, fonts.body, 2, C.cream, 'right');
}

/** Draws one card format onto `canvas`, sized to it. */
export function drawWrapped26Card(canvas: HTMLCanvasElement, format: Wrapped26CardFormat, content: CardContent, photo: HTMLImageElement | null, fonts: CardFonts) {
  const { width, height } = CARD_SIZES[format];
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d') as Ctx | null;
  if (!ctx) return;
  ctx.textBaseline = 'alphabetic';
  if (format === 'story') drawStory(ctx, content, photo, fonts);
  else if (format === 'square') drawSquare(ctx, content, photo, fonts);
  else drawLandscape(ctx, content, photo, fonts);
}

/**
 * Which card each share target gets (BUILD_SPEC §6): the tall story for
 * WhatsApp Status, Instagram Stories and Save image, the square for X, the
 * landscape for LinkedIn.
 */
/**
 * The card held up on slide 10 is 480 x 580 on the 1080 x 1920 stage, turned
 * 3 degrees with a 16 px shadow, so it needs about 620 px of height. When the
 * forecast runs to four lines and the share list is open, the space between
 * them is shorter than that, and a card at full size lies over the headline and
 * the first row of share buttons. It shrinks to fit instead, never grows.
 */
export const PREVIEW_CARD_FOOTPRINT = 620;

export function previewCardScale(areaHeight: number): number {
  if (!(areaHeight > 0)) return 1;
  return Math.min(1, areaHeight / PREVIEW_CARD_FOOTPRINT);
}

export const FORMAT_FOR: Record<'whatsapp' | 'instagram' | 'x' | 'linkedin' | 'save', Wrapped26CardFormat> = {
  whatsapp: 'story',
  instagram: 'story',
  save: 'story',
  x: 'square',
  linkedin: 'landscape',
};
