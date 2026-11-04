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
  ctx.fillStyle = ink;

  // The kicker and the vibe line.
  let y = PAD + 52;
  ctx.font = body(40, 600);
  ctx.fillText('My post-Bar Finals vibe:', PAD, y);
  y += 36;
  const line = fitText(vibe.line, { width: SHARE_WIDTH - PAD * 2, maxLines: 4, max: 104, min: 64 }, measureDisplay);
  ctx.font = display(line.size);
  for (const text of line.lines) {
    y += line.size * 1.08;
    ctx.fillText(text, PAD, y);
  }

  // The face card: the photo, else the placeholder face; the prop sits on top.
  const faceSize = 600;
  const faceX = (SHARE_WIDTH - faceSize) / 2;
  const faceY = Math.max(y + 64, 640);
  ctx.save();
  roundRect(ctx, faceX, faceY, faceSize, faceSize, 56);
  ctx.fillStyle = WRAPPED_COLOURS.cream;
  ctx.fill();
  ctx.clip();
  if (photo) {
    drawCover(ctx, photo, faceX, faceY, faceSize, faceSize);
  } else {
    ctx.fillStyle = ink;
    ctx.font = display(260);
    ctx.textAlign = 'center';
    ctx.fillText(record.student.first_name.charAt(0).toUpperCase() || 'L', SHARE_WIDTH / 2, faceY + faceSize / 2 + 92);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  ctx.lineWidth = 10;
  ctx.strokeStyle = ink;
  roundRect(ctx, faceX, faceY, faceSize, faceSize, 56);
  ctx.stroke();
  // The prop label stands in for the prop art until it arrives.
  ctx.font = body(32, 700);
  const propText = vibe.prop.toUpperCase();
  const propWidth = Math.min(faceSize - 40, ctx.measureText(propText).width + 56);
  const propX = SHARE_WIDTH / 2 - propWidth / 2;
  const propY = faceY + faceSize - 44;
  ctx.fillStyle = ink;
  roundRect(ctx, propX, propY, propWidth, 76, 38);
  ctx.fill();
  ctx.fillStyle = WRAPPED_COLOURS.cream;
  ctx.textAlign = 'center';
  ctx.fillText(propText, SHARE_WIDTH / 2, propY + 50, faceSize - 80);
  ctx.textAlign = 'left';

  // Three stat stickers, and the campaign line stacked beside them.
  const stickersY = faceY + faceSize + 96;
  const stickerW = 560;
  record.stickers.slice(0, 3).forEach((sticker, i) => {
    const { value, label } = stickerText(sticker);
    const sy = stickersY + i * 132;
    ctx.fillStyle = WRAPPED_COLOURS.cream;
    roundRect(ctx, PAD, sy, stickerW, 112, 28);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = display(56);
    ctx.fillText(value, PAD + 32, sy + 76, 230);
    const valueWidth = Math.min(230, ctx.measureText(value).width);
    ctx.font = body(32, 600);
    ctx.fillText(label, PAD + 32 + valueWidth + 20, sy + 70, stickerW - valueWidth - 84);
  });
  const campaignX = PAD + stickerW + 52;
  CAMPAIGN_LINE.forEach((text, i) => {
    const cy = stickersY + 74 + i * 132;
    ctx.font = display(58);
    if (i === CAMPAIGN_LINE.length - 1) {
      // "The Bench." is highlighted (spec).
      const width = ctx.measureText(text).width;
      ctx.fillStyle = ink;
      roundRect(ctx, campaignX - 16, cy - 62, width + 32, 84, 16);
      ctx.fill();
      ctx.fillStyle = WRAPPED_COLOURS.cream;
    } else {
      ctx.fillStyle = ink;
    }
    ctx.fillText(text, campaignX, cy, SHARE_WIDTH - campaignX - PAD + 16);
  });

  // The persona sticker.
  const personaY = stickersY + 3 * 132 + 28;
  const persona = PERSONAS[record.persona.key]?.name ?? PERSONAS.steady_learned_friend.name;
  ctx.font = display(48);
  const personaW = Math.min(SHARE_WIDTH - PAD * 2, ctx.measureText(persona).width + 72);
  ctx.fillStyle = ink;
  roundRect(ctx, PAD, personaY, personaW, 96, 48);
  ctx.fill();
  ctx.fillStyle = WRAPPED_COLOURS.gold;
  ctx.fillText(persona, PAD + 36, personaY + 66, personaW - 72);

  // Who, and where to get one.
  const footY = SHARE_HEIGHT - PAD;
  ctx.fillStyle = ink;
  ctx.font = body(36, 700);
  const campus = record.student.campus ? ` · ${CAMPUS_NAMES[record.student.campus]} Campus` : '';
  ctx.fillText(`${shareName(record.student.first_name, record.student.last_initial)}${campus}`, PAD, footY - 64);
  ctx.font = body(36, 500);
  ctx.fillText(`Get yours · ${WRAPPED_URL}`, PAD, footY);
}

/** The canvas as a PNG file, for the share sheet and Save image. */
export function canvasToFile(canvas: HTMLCanvasElement, name = 'lawexa-wrapped.png'): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? new File([blob], name, { type: 'image/png' }) : null), 'image/png');
  });
}
