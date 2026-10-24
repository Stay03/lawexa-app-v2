import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/* `rows.ts` imports its icons from lucide-react, which the node test loader
 * does not resolve, so the table is pinned by its source text. */

const rows = readFileSync(join(process.cwd(), 'v2', 'features', 'settings', 'rows.ts'), 'utf8').replace(/\r\n/g, '\n');

test("My requests is a row in Your account, right after Your stats, opening v1's address", () => {
  const stats = rows.indexOf("id: 'stats',");
  const requests = rows.indexOf("id: 'requests',");
  const verification = rows.indexOf("id: 'verification',");
  assert.ok(stats > 0 && requests > stats && verification > requests);
  assert.match(
    rows,
    /id: 'requests',\n\s+label: 'My requests',\n\s+icon: ClipboardList,\n\s+href: '\/content-requests',\n\s+requiresAccount: true,\n/,
  );
});

test('Appearance keeps its row onto its own page', () => {
  assert.match(rows, /id: 'appearance',\n\s+label: 'Appearance',\n\s+icon: Paintbrush,\n\s+href: '\/settings\/appearance',\n/);
});
