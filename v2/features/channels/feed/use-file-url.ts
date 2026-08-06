'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { filesApi } from '@/lib/api/files';

/**
 * use-file-url — the two things every surface does with a channel file's bytes:
 * mint a URL that works, and open one in a tab.
 *
 * ── NOTHING IN THE FEED EVER FOLLOWS `attachment.url` ──────────────────────
 * That URL is pre-signed for ONE HOUR (measured: `X-Amz-Expires=3600`), and a
 * chat tab lives longer than an hour without anyone thinking about it. A link
 * built from it works this morning and 403s this afternoon, with nothing on
 * screen to say why. So `url` is only ever PAINTED — where a failure is visible
 * and recoverable — and every OPENING goes through `GET /files/{id}/download`,
 * minted at press time, which is the same gated endpoint the Files tab
 * downloads through and the only URL in this system fresh by construction.
 *
 * ── IT IS A MODULE BECAUSE THREE SURFACES SHARE IT ────────────────────────
 * The inline attachment tile, the named file row and the full-screen picture
 * viewer all mint and all open. Copying the pair into the viewer is how the
 * three would drift on what "open" means — and the popup rule below is exactly
 * the kind of hard-won detail that only survives in one copy. The feed's other
 * one-idiom hooks (`use-long-press`, `use-held-value`) already set the
 * precedent of a `use-*.ts` module beside the components that share it.
 */

/**
 * Mint a FRESH signed URL for a file. `silentError` because the channel
 * surfaces raise no toasts: a refused mint is reported in place, under the
 * thing that asked for it.
 */
export function useFreshFileUrl() {
  return useMutation({
    mutationFn: (id: number) => filesApi.getDownloadUrl(id),
    meta: { silentError: true },
  });
}

export interface OpenInNewTab {
  open: (id: number) => void;
  opening: boolean;
  /** The last attempt was refused or blocked. Say so where it was pressed. */
  failed: boolean;
}

/**
 * Open a file in a new tab through a freshly minted URL.
 *
 * `window.open` runs after the round trip rather than in the click itself,
 * which is how the Files tab has always opened a file. That is deliberate
 * consistency, not an oversight: the same operation must not behave one way in
 * the library and another in the feed.
 *
 * IT IS ALSO THE ONE CASE THAT FAILS WITHOUT FAILING. A `window.open` outside
 * the click's own synchronous frame is a popup by every engine's rules, and iOS
 * Safari in particular simply returns `null` — no exception, no navigation.
 * Tapping would then do NOTHING AT ALL, which on touch is the whole feature. So
 * the return value is read, and a blocked open lands in {@link
 * OpenInNewTab.failed}: the reader is told, and "Try again" is a fresh gesture
 * the engine will honour.
 */
export function useOpenFileInNewTab(): OpenInNewTab {
  const fresh = useFreshFileUrl();
  const [failed, setFailed] = useState(false);
  const open = (id: number) => {
    setFailed(false);
    fresh.mutate(id, {
      onSuccess: (response) => {
        const url = response.data?.url;
        if (!url) {
          setFailed(true);
          return;
        }
        if (!window.open(url, '_blank', 'noopener')) setFailed(true);
      },
      onError: () => setFailed(true),
    });
  };
  return { open, opening: fresh.isPending, failed };
}
