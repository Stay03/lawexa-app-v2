import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import QRCode from 'qrcode';

import { qrMatrixPath } from './game-link-qr';

/* The game link's QR code (Stay's approval of `qrcode`, f730f71c, 11
 * November 2026). TEST DATA only. */

const LINK = 'https://lawexa.com/g/00000000-0000-4000-8000-000000000101?t=TESTDATA';

test('the path draws exactly the dark modules of the code, and only those', () => {
  const { size, d } = qrMatrixPath(LINK);
  const { modules } = QRCode.create(LINK, { errorCorrectionLevel: 'M' });
  assert.equal(size, modules.size);

  const drawn = new Set<string>();
  for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
    for (let i = 0; i < Number(w); i += 1) drawn.add(`${Number(x) + i},${y}`);
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      assert.equal(drawn.has(`${x},${y}`), Boolean(modules.get(y, x)), `module ${x},${y}`);
    }
  }
  // The top-left finder pattern opens the path: seven dark modules in a row.
  assert.ok(d.startsWith('M0 0h7v1h-7z'));
});

test('the same link always gives the same code', () => {
  assert.deepEqual(qrMatrixPath(LINK), qrMatrixPath(LINK));
  assert.notEqual(qrMatrixPath(LINK).d, qrMatrixPath(`${LINK}x`).d);
});

test('the code is black on white with its quiet zone, and has a large view', () => {
  const qr = readFileSync(join(process.cwd(), 'v2', 'features', 'channels', 'quiz', 'GameLinkQr.tsx'), 'utf8');
  assert.match(qr, /viewBox=\{`\$\{-QR_QUIET_ZONE\} \$\{-QR_QUIET_ZONE\} \$\{box\} \$\{box\}`\}/);
  assert.match(qr, /className=\{cn\('block bg-white', className\)\}/);
  assert.match(qr, /<path d=\{d\} fill="#000" \/>/);
  assert.match(qr, /onClick=\{\(\) => setLarge\(true\)\}/);
});
