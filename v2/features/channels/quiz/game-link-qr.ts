import QRCode from 'qrcode';

/**
 * The QR code of a game's link as one SVG path (`GameLinkQr` draws it).
 *
 * `qrcode` (npm, MIT; Stay's approval, f730f71c, 11 November 2026) only
 * builds the matrix here. Drawing it is ours: one path of 1 × 1 squares in a
 * `size` × `size` box, so the code is plain React markup with no HTML string,
 * and it scales to any size without blurring (the projector view).
 *
 * Level M survives a smudged screen or a glare spot (15% of the code), and a
 * game link is short enough that M stays a small, easy-to-scan grid.
 *
 * Pure, so a test pins it: the same link always gives the same path.
 */
export interface QrMatrixPath {
  /** Modules per side, the quiet zone not included. */
  size: number;
  /** The dark modules, in the box's own units. */
  d: string;
}

export function qrMatrixPath(text: string): QrMatrixPath {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = modules.size;
  const runs: string[] = [];
  for (let y = 0; y < size; y += 1) {
    // Neighbouring dark modules in a row are one rectangle, which keeps the path short.
    let x = 0;
    while (x < size) {
      if (!modules.get(y, x)) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < size && modules.get(y, x)) x += 1;
      runs.push(`M${start} ${y}h${x - start}v1h-${x - start}z`);
    }
  }
  return { size, d: runs.join('') };
}

/** The empty border scanners need around the code, in modules (the standard asks for 4). */
export const QR_QUIET_ZONE = 4;
