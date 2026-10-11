'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { filesApi } from '@/lib/api/files';
import { isNotFoundError } from '@/lib/utils/api-error';

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

export interface OpenInNewTab<T = number> {
  open: (target: T) => void;
  opening: boolean;
  /** The last attempt was refused or blocked. Say so where it was pressed. */
  failed: boolean;
  /**
   * The server answered 404: the file itself is gone, so trying again cannot
   * help. A confidential chat's files are deleted after 24 hours, and its
   * thread still names them (24 September 2026). Implies `failed`.
   */
  gone: boolean;
}

/**
 * Open a file in a new tab through a freshly minted URL.
 *
 * THE TAB OPENS IN THE TAP, THE URL ARRIVES AFTER (11 October 2026). Opening
 * after the mint's round trip made `window.open` a popup, outside the click's
 * own frame, and an iPhone home-screen app refuses popups without a word:
 * Arthur's zips spun, then said "Couldn't open it", and nothing downloaded,
 * while Safari let the same tap through. So the empty tab is opened
 * synchronously, inside the gesture every engine honours, and pointed at the
 * fresh URL once it is minted.
 *
 * `noopener` IS NOT PASSED. With it, `window.open` returns `null` whether or
 * not a tab opened, so a null check reported every open as a failure. Without
 * it the handle is real: `null` now means the engine refused, which is the only
 * case "Try again" is for. The handle's `opener` is cleared before it navigates,
 * which is what `noopener` was there to do. A failed mint closes the empty tab,
 * so a refusal never leaves a blank page behind.
 */
export function useOpenFileInNewTab(): OpenInNewTab {
  return useOpenUrlInNewTab(mintFileUrl);
}

async function mintFileUrl(id: number): Promise<string | null> {
  return (await filesApi.getDownloadUrl(id)).data?.url ?? null;
}

/**
 * The same open, for anything that can mint its own fresh URL: a channel file
 * through `GET /files/{id}/download`, a print note's picture by fetching the
 * notes again (10 October 2026). An empty answer is a failure, exactly as a
 * file mint that came back without a link always was.
 */
export function useOpenUrlInNewTab<T>(mint: (target: T) => Promise<string | null>): OpenInNewTab<T> {
  const fresh = useMutation({ mutationFn: mint, meta: { silentError: true } });
  const [failed, setFailed] = useState(false);
  const [gone, setGone] = useState(false);
  const open = (target: T) => {
    setFailed(false);
    setGone(false);
    const tab = window.open('', '_blank');
    if (!tab) {
      setFailed(true);
      return;
    }
    fresh.mutate(target, {
      onSuccess: (url) => {
        if (!url) {
          tab.close();
          setFailed(true);
          return;
        }
        tab.opener = null;
        tab.location.href = url;
      },
      onError: (error) => {
        tab.close();
        setFailed(true);
        setGone(isNotFoundError(error));
      },
    });
  };
  return { open, opening: fresh.isPending, failed, gone };
}
