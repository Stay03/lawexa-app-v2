import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cookies } from 'next/headers';

import { serviceWorkerBodyFor, SW_ENV, SW_GATE_COOKIES } from '@/v2/runtime/sw/serve';

/**
 * /sw.js — the v2 service worker's script, served per request so it can be
 * gated: the real worker (`v2/runtime/sw/lawexa-sw.js`) only for a browser
 * inside v2 with the `sw` performance layer on, and a worker that removes
 * itself for everyone else (`serve.ts` explains why removal works this way).
 *
 * A route handler and not a `public/` file for that reason, on the same terms
 * as `app/manifest.webmanifest/route.ts`. The proxy never sees this path (its
 * matcher skips any path with a dot), so it is answered the same way in v1 and
 * v2.
 *
 * `no-store`: the body depends on the reader's cookies. The browser already
 * skips its HTTP cache when it checks a worker for updates.
 *
 * The worker file is read once per server process from the app's working
 * directory, the same directory `next.config.ts` reads the build id from.
 */
let workerSource: string | undefined;

function realWorker(): string {
  workerSource ??= readFileSync(join(process.cwd(), 'v2', 'runtime', 'sw', 'lawexa-sw.js'), 'utf8');
  return workerSource;
}

export async function GET(): Promise<Response> {
  const store = await cookies();
  const body = serviceWorkerBodyFor(
    {
      uiCookie: store.get(SW_GATE_COOKIES.ui)?.value,
      perfValue: store.get(SW_GATE_COOKIES.perf)?.value,
      v2Enabled: process.env.V2_ENABLED === 'true',
      swSetting: process.env[SW_ENV],
    },
    realWorker(),
  );

  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
