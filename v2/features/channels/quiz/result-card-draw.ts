import { ordinal } from '@/lib/wrapped/copy';
import {
  cardCta,
  cardHeadline,
  cardInitials,
  cardStats,
  cardSubline,
  cardTier,
  type CardFormat,
  type ResultCardInput,
} from './result-card';
import {
  CARD_COLOURS,
  CARD_LAYOUTS,
  MEDAL_COLOURS,
  PODIUM_COLOURS,
  TRACKING,
  displayFont,
  fittedSize,
  headlineSetting,
  sublineLines,
  textFont,
  trackedWidth,
  type CardLayout,
  type Measure,
} from './result-card-layout';

/**
 * Draws the live quiz's result card (Arthur's design, `result-card-layout.ts`)
 * onto a canvas, in the story or the square size. The card is drawn rather
 * than captured from the page, so the PNG is the same on every phone. The
 * crown, the medal, the trophy and the Lawexa mark are Arthur's own shapes,
 * redrawn from the coordinates in his file.
 *
 * The 2D context is all it needs, so the picture tests draw it the same way
 * outside a browser.
 */

/** A picture the canvas can draw: an image element in the browser, or a decoded image in the picture tests. */
export type CardImage = CanvasImageSource & { width: number; height: number };

type Ctx = CanvasRenderingContext2D;

/**
 * Text with letter spacing, one character at a time. A character goes where
 * the kerned text up to and including it ends, less its own advance, so the
 * kern between it and the character before it is kept ("To" tucks the o
 * under the T, as in Arthur's file); then the spacing so far is added.
 * Canvas `letterSpacing` is missing from older Safari, which many phones
 * still run.
 */
function drawTracked(ctx: Ctx, text: string, x: number, baseline: number, size: number, tracking: number, align: 'left' | 'center') {
  const width = trackedWidth(text, ctx.font, size, tracking, (t) => ctx.measureText(t).width);
  const start = align === 'center' ? x - width / 2 : x;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (tracking === 0) {
    ctx.fillText(text, start, baseline);
    return;
  }
  const chars = [...text];
  let through = '';
  chars.forEach((char, index) => {
    through += char;
    const left = ctx.measureText(through).width - ctx.measureText(char).width;
    ctx.fillText(char, start + left + index * tracking * size, baseline);
  });
}

function roundedRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
  ctx.closePath();
}

function circle(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

/** The dark ground and its rays: 18 wedges of 9°, one every 20°, the far corners on whole pixels as Arthur's. */
function drawGround(ctx: Ctx, layout: CardLayout) {
  ctx.fillStyle = CARD_COLOURS.ground;
  ctx.fillRect(0, 0, layout.width, layout.height);
  const { cx, cy, radius } = layout.rays;
  ctx.fillStyle = CARD_COLOURS.rays;
  for (let ray = 0; ray < 18; ray += 1) {
    const from = (ray * 20 * Math.PI) / 180;
    const to = ((ray * 20 + 9) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(Math.round(cx + radius * Math.cos(from)), Math.round(cy + radius * Math.sin(from)));
    ctx.lineTo(Math.round(cx + radius * Math.cos(to)), Math.round(cy + radius * Math.sin(to)));
    ctx.closePath();
    ctx.fill();
  }
}

/** The stats band under a 4 px rule. */
function drawBand(ctx: Ctx, layout: CardLayout) {
  ctx.fillStyle = CARD_COLOURS.band;
  ctx.fillRect(0, layout.bandTop, layout.width, layout.height - layout.bandTop);
  ctx.fillStyle = CARD_COLOURS.rule;
  ctx.fillRect(0, layout.bandTop, layout.width, 4);
}

/** Arthur's Lawexa mark, a 96-unit drawing: a dark disc, and the gold page with its two lines and three columns. */
function drawMark(ctx: Ctx, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 96, size / 96);
  circle(ctx, 48, 48, 46);
  ctx.fillStyle = CARD_COLOURS.logoDisc;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = CARD_COLOURS.rule;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(34, 23);
  ctx.lineTo(64, 23);
  ctx.bezierCurveTo(68, 23, 70, 25, 70, 29);
  ctx.lineTo(70, 55);
  ctx.bezierCurveTo(70, 57.667, 68.667, 59.333, 66, 60);
  ctx.lineTo(35, 71);
  ctx.bezierCurveTo(31, 72.333, 29, 71, 29, 67);
  ctx.lineTo(29, 29);
  ctx.bezierCurveTo(29, 25, 30.667, 23, 34, 23);
  ctx.closePath();
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = CARD_COLOURS.gold;
  ctx.stroke();

  ctx.fillStyle = CARD_COLOURS.gold;
  roundedRect(ctx, 35, 29, 28, 3.5, 1);
  ctx.fill();
  roundedRect(ctx, 37.5, 34.5, 23, 3.5, 1);
  ctx.fill();
  for (const [left, bottom] of [
    [39, 64],
    [46.5, 61.2],
    [54, 58.6],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(left, 41);
    ctx.lineTo(left + 5, 41);
    ctx.lineTo(left + 5, bottom - 2);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** The mark and "Lawexa live quiz": centred as one on the story, at the column's left on the square. */
function drawBrand(ctx: Ctx, layout: CardLayout) {
  const brand = layout.brand;
  ctx.font = textFont(700, brand.textSize);
  const label = 'Lawexa live quiz';
  const labelWidth = trackedWidth(label, ctx.font, brand.textSize, TRACKING.none, (t) => ctx.measureText(t).width);
  const left = brand.align === 'center' ? brand.x - (brand.size + brand.gap + labelWidth) / 2 : brand.x;
  drawMark(ctx, left, brand.top, brand.size);
  ctx.fillStyle = CARD_COLOURS.white;
  drawTracked(ctx, label, left + brand.size + brand.gap, brand.baseline, brand.textSize, TRACKING.none, 'left');
}

/** The player's photo in the gold circle, fitted to cover it; their initials when there is no photo. */
function drawPhoto(ctx: Ctx, layout: CardLayout, photo: CardImage | null, initials: string) {
  const { cx, cy, r } = layout.photo;
  ctx.save();
  circle(ctx, cx, cy, r);
  ctx.clip();
  ctx.fillStyle = CARD_COLOURS.photoGround;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (photo && photo.width > 0 && photo.height > 0) {
    const scale = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
    const w = photo.width * scale;
    const h = photo.height * scale;
    ctx.drawImage(photo, cx - w / 2, cy - h / 2, w, h);
  } else if (initials) {
    const size = Math.round(r * 0.8);
    ctx.font = displayFont(size);
    ctx.fillStyle = CARD_COLOURS.medalInk;
    // Centred on the circle by the letters' own height, so two capitals sit in its middle.
    const metrics = ctx.measureText(initials);
    const ascent = metrics.actualBoundingBoxAscent;
    const descent = metrics.actualBoundingBoxDescent;
    drawTracked(ctx, initials, cx, cy + (ascent - descent) / 2, size, TRACKING.headline, 'center');
  }
  ctx.restore();
}

/** Arthur's crown for 1st, a 96 × 56 drawing: five points and three gold balls. */
function drawCrown(ctx: Ctx, layout: CardLayout) {
  const { x, y, scale } = layout.crown;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = CARD_COLOURS.gold;
  ctx.beginPath();
  ctx.moveTo(8, 52);
  ctx.lineTo(3, 14);
  ctx.lineTo(28, 31);
  ctx.lineTo(48, 4);
  ctx.lineTo(68, 31);
  ctx.lineTo(93, 14);
  ctx.lineTo(88, 52);
  ctx.closePath();
  ctx.fill();
  for (const [bx, by, br] of [
    [3, 14, 3],
    [48, 4, 4],
    [93, 14, 3],
  ] as const) {
    circle(ctx, bx, by, br);
    ctx.fill();
  }
  ctx.restore();
}

/** The medal for 1st to 3rd, a 140-unit drawing: the blue and gold ribbon, then the disc with the place's number. */
function drawMedal(ctx: Ctx, layout: CardLayout, rank: 1 | 2 | 3) {
  const { x, y, scale } = layout.medal;
  const colours = MEDAL_COLOURS[rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze'];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const strap = (points: readonly (readonly [number, number])[], colour: string) => {
    ctx.beginPath();
    points.forEach(([px, py], index) => (index === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
  };
  strap(
    [
      [22, 0],
      [62, 0],
      [80, 104],
      [50, 112],
    ],
    CARD_COLOURS.ribbonLeft,
  );
  strap(
    [
      [78, 0],
      [118, 0],
      [90, 112],
      [60, 104],
    ],
    CARD_COLOURS.ribbonRight,
  );
  circle(ctx, 70, 130, 56);
  ctx.fillStyle = colours.face;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = colours.rim;
  ctx.stroke();
  circle(ctx, 70, 130, 40);
  ctx.lineWidth = 3;
  ctx.strokeStyle = colours.ring;
  ctx.stroke();
  ctx.font = displayFont(64);
  ctx.fillStyle = CARD_COLOURS.medalInk;
  drawTracked(ctx, String(rank), 70, 153, 64, TRACKING.none, 'center');
  ctx.restore();
}

/** The "Top 10" pill for 4th to 10th: gold on a darker lip, a trophy, the words. */
function drawTopTenBadge(ctx: Ctx, layout: CardLayout) {
  const badge = layout.badge;
  const radius = badge.h / 2;
  ctx.fillStyle = CARD_COLOURS.goldLip;
  roundedRect(ctx, badge.x, badge.y + badge.lip, badge.w, badge.h, radius);
  ctx.fill();
  ctx.fillStyle = CARD_COLOURS.gold;
  roundedRect(ctx, badge.x, badge.y, badge.w, badge.h, radius);
  ctx.fill();

  ctx.font = textFont(700, badge.size);
  const label = 'Top 10';
  const iconBox = 24 * badge.iconScale;
  const labelWidth = trackedWidth(label, ctx.font, badge.size, TRACKING.none, (t) => ctx.measureText(t).width);
  const left = badge.x + (badge.w - (iconBox + badge.gap + labelWidth)) / 2;
  const iconTop = badge.y + (badge.h - iconBox) / 2;

  ctx.save();
  ctx.translate(left, iconTop);
  ctx.scale(badge.iconScale, badge.iconScale);
  ctx.strokeStyle = CARD_COLOURS.goldInk;
  ctx.lineWidth = 2;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  // The trophy, on a 24-unit grid: the cup, its two handles, the stem and the foot.
  ctx.beginPath();
  ctx.moveTo(7, 4);
  ctx.lineTo(17, 4);
  ctx.lineTo(17, 9);
  ctx.arc(12, 9, 5, 0, Math.PI);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(7, 6);
  ctx.lineTo(4, 6);
  ctx.lineTo(4, 7);
  ctx.arc(7, 7, 3, Math.PI, Math.PI / 2, true);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(17, 6);
  ctx.lineTo(20, 6);
  ctx.lineTo(20, 7);
  ctx.arc(17, 7, 3, 0, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, 14);
  ctx.lineTo(12, 18);
  ctx.moveTo(8, 20);
  ctx.lineTo(16, 20);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = CARD_COLOURS.goldInk;
  drawTracked(ctx, label, left + iconBox + badge.gap, badge.baseline, badge.size, TRACKING.none, 'left');
}

/** The podium block in the place's colours, with the place in large type on its front. */
function drawPodium(ctx: Ctx, layout: CardLayout, rank: number, measure: Measure) {
  const podium = layout.podium;
  const colours = PODIUM_COLOURS[cardTier(rank)];
  const right = podium.left + podium.width;
  const front = podium.top + podium.bevel;

  ctx.fillStyle = colours.top;
  ctx.beginPath();
  ctx.moveTo(podium.left + podium.inset, podium.top);
  ctx.lineTo(right - podium.inset, podium.top);
  ctx.lineTo(right, front);
  ctx.lineTo(podium.left, front);
  ctx.closePath();
  ctx.fill();

  const gradient = ctx.createLinearGradient(0, front, 0, podium.bottom);
  gradient.addColorStop(0, colours.from);
  gradient.addColorStop(1, colours.to);
  ctx.fillStyle = gradient;
  ctx.fillRect(podium.left, front, podium.width, podium.bottom - front);

  const place = ordinal(rank);
  const size = fittedSize(place, displayFont, podium.place.size, TRACKING.place, podium.place.maxWidth, measure);
  ctx.font = displayFont(size);
  ctx.fillStyle = CARD_COLOURS.white;
  drawTracked(ctx, place, podium.place.cx, podium.place.baseline, size, TRACKING.place, 'center');
}

/** The gold button with its darker lip, and "Play at lawexa.com" on it. */
function drawButton(ctx: Ctx, layout: CardLayout) {
  const button = layout.button;
  ctx.fillStyle = CARD_COLOURS.goldLip;
  roundedRect(ctx, button.x, button.y + button.lip, button.w, button.h, button.r);
  ctx.fill();
  ctx.fillStyle = CARD_COLOURS.gold;
  roundedRect(ctx, button.x, button.y, button.w, button.h, button.r);
  ctx.fill();
  ctx.font = textFont(700, button.size);
  ctx.fillStyle = CARD_COLOURS.goldInk;
  drawTracked(ctx, 'Play at lawexa.com', button.x + button.w / 2, button.baseline, button.size, TRACKING.none, 'center');
}

/** Draws the whole card for a player's finish. The canvas is sized here. */
export function drawResultCard(canvas: HTMLCanvasElement, input: ResultCardInput, format: CardFormat, photo: CardImage | null): void {
  const layout = CARD_LAYOUTS[format];
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const measure: Measure = (text, font) => {
    ctx.font = font;
    return ctx.measureText(text).width;
  };

  drawGround(ctx, layout);
  drawBand(ctx, layout);
  drawPodium(ctx, layout, input.rank, measure);
  drawPhoto(ctx, layout, photo, cardInitials(input.playerName));
  if (input.rank === 1) drawCrown(ctx, layout);
  if (input.rank <= 3) drawMedal(ctx, layout, input.rank as 1 | 2 | 3);
  else if (input.rank <= 10) drawTopTenBadge(ctx, layout);

  drawBrand(ctx, layout);

  const setting = headlineSetting(format, input.rank);
  ctx.font = displayFont(setting.size);
  ctx.fillStyle = CARD_COLOURS.white;
  cardHeadline(input.rank).forEach((line, index) => {
    drawTracked(ctx, line, layout.headline.x, setting.baselines[index], setting.size, TRACKING.headline, layout.headline.align);
  });

  const { lead, title } = cardSubline(input);
  const subline = sublineLines(lead, title, format, input.rank, measure);
  ctx.font = textFont(500, subline.size);
  ctx.fillStyle = CARD_COLOURS.subline;
  for (const line of subline.lines) drawTracked(ctx, line.text, layout.subline.x, line.baseline, subline.size, TRACKING.none, layout.subline.align);

  ctx.font = textFont(700, layout.cta.size);
  ctx.fillStyle = CARD_COLOURS.white;
  drawTracked(ctx, cardCta(input.rank), layout.cta.x, layout.cta.baseline, layout.cta.size, TRACKING.none, layout.cta.align);
  drawButton(ctx, layout);

  const stats = layout.stats;
  cardStats(input).forEach((stat, index) => {
    const centre = stats.centres[index];
    const valueSize = fittedSize(stat.value, displayFont, stats.valueSize, TRACKING.none, stats.maxWidth, measure);
    ctx.font = displayFont(valueSize);
    ctx.fillStyle = CARD_COLOURS.white;
    drawTracked(ctx, stat.value, centre, stats.valueBaseline, valueSize, TRACKING.none, 'center');
    ctx.font = textFont(500, stats.labelSize);
    ctx.fillStyle = CARD_COLOURS.label;
    drawTracked(ctx, stat.label, centre, stats.labelBaseline, stats.labelSize, TRACKING.none, 'center');
  });
}
