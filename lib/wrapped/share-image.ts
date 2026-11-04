import { CAMPAIGN_LINE, CAMPUS_NAMES, PERSONAS, STICKER_LABELS, WRAPPED_URL, formatCount, shareName, vibeFor } from './copy';
import { fitText, type Measure } from './text-fit';
import { SHARE_HEIGHT, SHARE_WIDTH, VIBE_BACKGROUNDS, WRAPPED_COLOURS } from './theme';
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
 * The face card shows the profile photo when there is one, else a placeholder
 * until Arthur's 30 illustrated faces arrive.
 */

export interface ShareFonts {
  /** The CSS family names next/font gave Unbounded and Inter. */
  display: string;
  body: string;
}

const PAD = 84;

function stickerText(sticker: WrappedSticker): { value: string; label: string } {
  const value = typeof sticker.value === 'number' ? formatCount(sticker.value) : String(sticker.value);
  return { value, label: STICKER_LABELS[sticker.key] ?? '' };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The photo, cropped to cover the box. */
function drawCover(ctx: CanvasRenderingContext2D, image: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Loads a picture for the canvas; null when it cannot (no CORS, offline): the placeholder face shows. */
export function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/**
 * Where everything sits on the 1080 × 1920 poster, worked out from the bottom
 * edge up, so the bottom block (stickers, persona, name, link) never overlaps
 * and the face takes the room the vibe line leaves. Pure, so a test pins it.
 */
export function shareLayout(lineBottom: number) {
  const footY = SHARE_HEIGHT - PAD; // "Get yours · lawexa.com/wrapped"
  const nameY = footY - 60;
  const personaH = 96;
  const personaY = nameY - 40 - 34 - personaH;
  const stickerH = 108;
  const stickerGap = 18;
  const stickersY = personaY - 44 - (3 * stickerH + 2 * stickerGap);
  const faceTop = lineBottom + 56;
  const faceBottom = stickersY - 84; // room for the prop label under the card
  const faceSize = Math.max(320, Math.min(600, faceBottom - faceTop));
  return { footY, nameY, personaY, personaH, stickersY, stickerH, stickerGap, faceTop, faceSize };
}

export function drawShareCard(
  canvas: HTMLCanvasElement,
  record: WrappedRecord,
  fonts: ShareFonts,
  photo: HTMLImageElement | null,
): void {
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const vibe = vibeFor(record.vibe.id);
  const ink = WRAPPED_COLOURS.ink;
  const cream = WRAPPED_COLOURS.cream;
  const display = (size: number) => `700 ${size}px ${fonts.display}`;
  const body = (size: number, weight = 500) => `${weight} ${size}px ${fonts.body}`;
  const measureDisplay: Measure = (text, size) => {
    ctx.font = display(size);
    return ctx.measureText(text).width;
  };

  // Ground, to the bottom edge.
  ctx.fillStyle = VIBE_BACKGROUNDS[vibe.colour];
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // The kicker and the vibe line.
  ctx.fillStyle = ink;
  ctx.font = body(40, 600);
  let y = PAD + 52;
  ctx.fillText('My post-Bar Finals vibe:', PAD, y);
  y += 30;
  const line = fitText(vibe.line, { width: SHARE_WIDTH - PAD * 2, maxLines: 4, max: 104, min: 60 }, measureDisplay);
  ctx.font = display(line.size);
  for (const text of line.lines) {
    y += line.size * 1.08;
    ctx.fillText(text, PAD, y);
  }
  const at = shareLayout(y + line.size * 0.25);

  // The face card: the photo, else the placeholder face; the prop sits on top.
  const faceX = (SHARE_WIDTH - at.faceSize) / 2;
  const radius = Math.round(at.faceSize * 0.09);
  ctx.save();
  roundRect(ctx, faceX, at.faceTop, at.faceSize, at.faceSize, radius);
  ctx.fillStyle = cream;
  ctx.fill();
  ctx.clip();
  if (photo) {
    drawCover(ctx, photo, faceX, at.faceTop, at.faceSize, at.faceSize);
  } else {
    ctx.fillStyle = ink;
    ctx.font = display(Math.round(at.faceSize * 0.44));
    ctx.textAlign = 'center';
    ctx.fillText(record.student.first_name.charAt(0).toUpperCase() || 'L', SHARE_WIDTH / 2, at.faceTop + at.faceSize * 0.66);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  ctx.lineWidth = 10;
  ctx.strokeStyle = ink;
  roundRect(ctx, faceX, at.faceTop, at.faceSize, at.faceSize, radius);
  ctx.stroke();
  // The prop label stands in for the prop art until it arrives.
  ctx.font = body(32, 700);
  const propText = vibe.prop.toUpperCase();
  const propW = Math.min(at.faceSize + 120, ctx.measureText(propText).width + 56);
  const propY = at.faceTop + at.faceSize - 38;
  ctx.fillStyle = ink;
  roundRect(ctx, SHARE_WIDTH / 2 - propW / 2, propY, propW, 76, 38);
  ctx.fill();
  ctx.fillStyle = cream;
  ctx.textAlign = 'center';
  ctx.fillText(propText, SHARE_WIDTH / 2, propY + 50, propW - 40);
  ctx.textAlign = 'left';

  // Three stat stickers, and the campaign line stacked beside them.
  const stickerW = 520;
  record.stickers.slice(0, 3).forEach((sticker, i) => {
    const { value, label } = stickerText(sticker);
    const sy = at.stickersY + i * (at.stickerH + at.stickerGap);
    ctx.fillStyle = cream;
    roundRect(ctx, PAD, sy, stickerW, at.stickerH, 28);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = display(54);
    ctx.fillText(value, PAD + 30, sy + 74, 220);
    const valueW = Math.min(220, ctx.measureText(value).width);
    ctx.font = body(30, 600);
    ctx.fillText(label, PAD + 30 + valueW + 18, sy + 68, stickerW - valueW - 78);
  });
  const campaignX = PAD + stickerW + 48;
  const campaignW = SHARE_WIDTH - PAD - campaignX;
  // One size for the three lines, the largest at which "The Bench." and its highlight fit.
  let campaignSize = 58;
  while (campaignSize > 34 && measureDisplay(CAMPAIGN_LINE[2], campaignSize) + 32 > campaignW) campaignSize -= 2;
  CAMPAIGN_LINE.forEach((text, i) => {
    const cy = at.stickersY + 74 + i * (at.stickerH + at.stickerGap);
    ctx.font = display(campaignSize);
    if (i === CAMPAIGN_LINE.length - 1) {
      // "The Bench." is highlighted (spec).
      ctx.fillStyle = ink;
      roundRect(ctx, campaignX, cy - campaignSize * 1.02, measureDisplay(text, campaignSize) + 32, campaignSize * 1.42, 14);
      ctx.fill();
      ctx.fillStyle = cream;
      ctx.font = display(campaignSize);
      ctx.fillText(text, campaignX + 16, cy);
    } else {
      ctx.fillStyle = ink;
      ctx.fillText(text, campaignX + 16, cy);
    }
  });

  // The persona sticker.
  const persona = PERSONAS[record.persona.key]?.name ?? PERSONAS.steady_learned_friend.name;
  ctx.font = display(46);
  const personaW = Math.min(SHARE_WIDTH - PAD * 2, ctx.measureText(persona).width + 72);
  ctx.fillStyle = ink;
  roundRect(ctx, PAD, at.personaY, personaW, at.personaH, at.personaH / 2);
  ctx.fill();
  ctx.fillStyle = WRAPPED_COLOURS.gold;
  ctx.fillText(persona, PAD + 36, at.personaY + 64, personaW - 72);

  // Who, and where to get one.
  ctx.fillStyle = ink;
  ctx.font = body(36, 700);
  const campus = record.student.campus ? ` · ${CAMPUS_NAMES[record.student.campus]} Campus` : '';
  ctx.fillText(`${shareName(record.student.first_name, record.student.last_initial)}${campus}`, PAD, at.nameY, SHARE_WIDTH - PAD * 2);
  ctx.font = body(36, 500);
  ctx.fillText(`Get yours · ${WRAPPED_URL}`, PAD, at.footY, SHARE_WIDTH - PAD * 2);
}

/** The canvas as a PNG file, for the share sheet and Save image. */
export function canvasToFile(canvas: HTMLCanvasElement, name = 'lawexa-wrapped.png'): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? new File([blob], name, { type: 'image/png' }) : null), 'image/png');
  });
}
