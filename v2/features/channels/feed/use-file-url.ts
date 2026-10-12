'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

import { filesApi } from '@/lib/api/files';
import { isNotFoundError } from '@/lib/utils/api-error';
import {
  canShareKind,
  fetchAsFile,
  isInstalledIosApp,
  shareFile,
  type SaveAs,
} from './save-file';

export type { SaveAs } from './save-file';

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
 *
 * ── AN INSTALLED iPHONE APP SAVES THROUGH THE SHARE SHEET ─────────────────
 * Its tabs cannot save a download (12 October 2026), so there, and only there,
 * a file the reader is fetching goes to the share sheet instead of a tab. The
 * detector and the share call are pure, in `./save-file.ts`; the hook that
 * runs them is {@link useShareSheetSave} below.
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
  /** `saveAs` names a file the reader is fetching rather than viewing; only
   *  then can an installed iPhone app take the share sheet instead of the tab
   *  (see {@link useShareSheetSave}). Pictures pass none and keep the tab. */
  open: (target: T, saveAs?: SaveAs) => void;
  opening: boolean;
  /** The last attempt was refused or blocked. Say so where it was pressed. */
  failed: boolean;
  /**
   * The server answered 404: the file itself is gone, so trying again cannot
   * help. A confidential chat's files are deleted after 24 hours, and its
   * thread still names them (24 September 2026). Implies `failed`.
   */
  gone: boolean;
  /** The bytes are here and the share sheet is waiting for one more tap. */
  ready: boolean;
  /** That tap: offer the fetched file to the share sheet. */
  save: () => void;
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

/** {@link useShareSheetSave} for a channel file, minted by its id. */
export function useFileShareSheetSave(): ShareSheetSave {
  return useShareSheetSave(mintFileUrl);
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
  const shareSheet = useShareSheetSave(mint);
  const [failed, setFailed] = useState(false);
  const [gone, setGone] = useState(false);
  const openInTab = (target: T) => {
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
  const open = (target: T, saveAs?: SaveAs) => {
    if (!saveAs) {
      openInTab(target);
      return;
    }
    shareSheet.saveOr(target, saveAs, () => openInTab(target));
  };
  return {
    open,
    opening: fresh.isPending || shareSheet.saving,
    failed: failed || shareSheet.failed,
    gone: gone || shareSheet.gone,
    ready: shareSheet.ready,
    save: shareSheet.save,
  };
}

export interface ShareSheetSave<T = number> {
  /**
   * In an installed iPhone or iPad app that can share this kind of file, mint,
   * fetch and offer it to the share sheet. Anywhere else run `elsewhere`, the
   * surface's own path, in the same tap.
   */
  saveOr: (target: T, saveAs: SaveAs, elsewhere: () => void) => void;
  /** Minting, fetching, or the sheet is open. */
  saving: boolean;
  failed: boolean;
  /** The server answered 404. Implies `failed`. */
  gone: boolean;
  /** The bytes are here and the share sheet is waiting for one more tap. */
  ready: boolean;
  /** That tap. */
  save: () => void;
}

type ShareSheetState =
  | { phase: 'idle' }
  | { phase: 'sharing' }
  | { phase: 'ready'; file: File; holder: HeldFile }
  | { phase: 'failed'; gone: boolean };

/** Hands a waiting file back, which puts its card back to rest. */
interface HeldFile {
  release: () => void;
}

/**
 * ONE FILE WAITS AT A TIME. A file held for its second tap is the whole file in
 * memory, and a reader who taps three zips without saving any would otherwise
 * hold all three. Holding a new one releases the last, whose card simply goes
 * back to rest: tapping it again fetches it again.
 */
let heldFile: HeldFile | null = null;

function holdFile(holder: HeldFile) {
  if (heldFile && heldFile !== holder) heldFile.release();
  heldFile = holder;
}

function letGoOfFile(holder: HeldFile) {
  if (heldFile === holder) heldFile = null;
}

/**
 * Save a file through the share sheet, in an installed iPhone or iPad app only
 * (`./save-file.ts` says why the tab cannot save there).
 *
 * THE TAP MAY RUN OUT BEFORE THE BYTES ARRIVE. The mint and the download both
 * start in the tap, and the sheet is offered the moment the File exists. If
 * that is still inside the tap's few seconds, the sheet opens and one tap was
 * enough. If not, WebKit refuses with `NotAllowedError`, and the card holds the
 * File and says "Ready, tap to save": that second tap is fresh, and it offers
 * the bytes already fetched. A closed sheet is the reader's choice and puts the
 * card back to rest. A failed mint or download says so in place, as the tab's
 * failures do; a 404 is `gone`.
 *
 * Mutation-level callbacks, so a card that unmounts while the bytes are on the
 * way never opens a sheet over whatever the reader went to next.
 */
export function useShareSheetSave<T>(mint: (target: T) => Promise<string | null>): ShareSheetSave<T> {
  const fetchFile = useMutation({
    mutationFn: async ({ target, saveAs }: { target: T; saveAs: SaveAs }) => {
      const url = await mint(target);
      if (!url) throw new Error('The download link came back empty.');
      return fetchAsFile(url, saveAs);
    },
    meta: { silentError: true },
  });
  const [state, setState] = useState<ShareSheetState>({ phase: 'idle' });

  const rest = () => {
    if (state.phase === 'idle') return;
    if (state.phase === 'ready') letGoOfFile(state.holder);
    setState({ phase: 'idle' });
  };

  const offer = async (file: File) => {
    setState({ phase: 'sharing' });
    const outcome = await shareFile(navigator, file);
    if (outcome === 'needs-tap') {
      const holder: HeldFile = {
        release: () => setState((current) => (current.phase === 'ready' ? { phase: 'idle' } : current)),
      };
      holdFile(holder);
      setState({ phase: 'ready', file, holder });
      return;
    }
    setState(outcome === 'refused' ? { phase: 'failed', gone: false } : { phase: 'idle' });
  };

  const saveOr = (target: T, saveAs: SaveAs, elsewhere: () => void) => {
    rest();
    const installedIosApp = isInstalledIosApp({
      navigator,
      matchMedia: (query) => window.matchMedia(query),
    });
    if (!installedIosApp || !canShareKind(navigator, saveAs)) {
      elsewhere();
      return;
    }
    fetchFile.mutate(
      { target, saveAs },
      {
        onSuccess: (file) => void offer(file),
        onError: (error) => setState({ phase: 'failed', gone: isNotFoundError(error) }),
      },
    );
  };

  const save = () => {
    if (state.phase !== 'ready') return;
    letGoOfFile(state.holder);
    void offer(state.file);
  };

  return {
    saveOr,
    saving: fetchFile.isPending || state.phase === 'sharing',
    failed: state.phase === 'failed',
    gone: state.phase === 'failed' && state.gone,
    ready: state.phase === 'ready',
    save,
  };
}
