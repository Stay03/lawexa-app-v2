import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  canShareKind,
  fetchAsFile,
  isInstalledIosApp,
  shareFile,
  type InstalledAppEnvironment,
  type ShareSheet,
} from './save-file';

/* The installed iPhone app's save (Arthur, 12 October 2026): in the home-screen
 * app a channel file's tab is an in-app view that cannot save a download, so
 * there the bytes go to the share sheet. The detector and the share call are
 * pure and run here; the hooks and components import React and the API client,
 * so their routing is pinned by source. */

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const WINDOWS_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

function environment(
  userAgent: string,
  { maxTouchPoints = 0, standalone, displayStandalone = false }: {
    maxTouchPoints?: number;
    standalone?: boolean;
    displayStandalone?: boolean;
  } = {},
): InstalledAppEnvironment {
  return {
    navigator: { userAgent, maxTouchPoints, standalone },
    matchMedia: (query) => ({ matches: query === '(display-mode: standalone)' && displayStandalone }),
  };
}

test('an iPhone home-screen app is detected', () => {
  assert.equal(isInstalledIosApp(environment(IPHONE_SAFARI, { maxTouchPoints: 5, standalone: true })), true);
  assert.equal(
    isInstalledIosApp(environment(IPHONE_SAFARI, { maxTouchPoints: 5, displayStandalone: true })),
    true,
    'the display mode alone is enough',
  );
});

test('Safari on the iPhone keeps the tab', () => {
  assert.equal(isInstalledIosApp(environment(IPHONE_SAFARI, { maxTouchPoints: 5, standalone: false })), false);
});

test('an iPad home-screen app with the desktop user agent is detected by its touch screen', () => {
  assert.equal(isInstalledIosApp(environment(IPAD_DESKTOP, { maxTouchPoints: 5, standalone: true })), true);
});

test('a Mac with the same user agent is not an iPad', () => {
  assert.equal(isInstalledIosApp(environment(IPAD_DESKTOP, { maxTouchPoints: 0, displayStandalone: true })), false);
});

test('an Android installed app keeps the tab', () => {
  assert.equal(isInstalledIosApp(environment(ANDROID_CHROME, { maxTouchPoints: 5, displayStandalone: true })), false);
});

test('a desktop browser keeps the tab', () => {
  assert.equal(isInstalledIosApp(environment(WINDOWS_CHROME)), false);
});

/** A share sheet that records the order of its calls. */
function sheet({
  canShare = true,
  shareError,
}: { canShare?: boolean; shareError?: Error } = {}): ShareSheet & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    canShare: () => {
      calls.push('canShare');
      return canShare;
    },
    share: async () => {
      calls.push('share');
      if (shareError) throw shareError;
    },
  };
}

const zip = new File(['PK'], 'brief.zip', { type: 'application/zip' });

test('canShare is asked before share', async () => {
  const fake = sheet();
  assert.equal(await shareFile(fake, zip), 'shared');
  assert.deepEqual(fake.calls, ['canShare', 'share']);
});

test('a file the sheet will not take is refused without calling share', async () => {
  const fake = sheet({ canShare: false });
  assert.equal(await shareFile(fake, zip), 'refused');
  assert.deepEqual(fake.calls, ['canShare']);
});

test('closing the sheet is not an error', async () => {
  assert.equal(await shareFile(sheet({ shareError: new DOMException('closed', 'AbortError') }), zip), 'dismissed');
});

test('a spent tap asks for one more tap instead of failing', async () => {
  assert.equal(
    await shareFile(sheet({ shareError: new DOMException('no gesture', 'NotAllowedError') }), zip),
    'needs-tap',
  );
});

test('any other share failure is refused', async () => {
  assert.equal(await shareFile(sheet({ shareError: new TypeError('bad data') }), zip), 'refused');
});

test('an engine without the share calls cannot take the share path', async () => {
  assert.equal(canShareKind({}, { name: 'brief.zip' }), false);
  assert.equal(await shareFile({}, zip), 'refused');
});

test('the probe asks with the file name and type, before any bytes', () => {
  let asked: ShareData | undefined;
  const probe: ShareSheet = {
    canShare: (data) => {
      asked = data;
      return true;
    },
    share: async () => {},
  };
  assert.equal(canShareKind(probe, { name: 'brief.pdf', type: 'application/pdf' }), true);
  const [file] = asked?.files ?? [];
  assert.equal(file?.name, 'brief.pdf');
  assert.equal(file?.type, 'application/pdf');
  assert.equal(file?.size, 0);
});

test('the bytes are fetched without credentials into a File with the real name and type', async () => {
  let init: RequestInit | undefined;
  const fetcher: typeof fetch = async (_url, options) => {
    init = options;
    return new Response(new Blob(['%PDF'], { type: 'binary/octet-stream' }));
  };
  const file = await fetchAsFile('https://bucket/x?sig', { name: 'brief.pdf', type: 'application/pdf' }, fetcher);
  assert.equal(init?.credentials, 'omit');
  assert.equal(file.name, 'brief.pdf');
  assert.equal(file.type, 'application/pdf');
  assert.equal(await file.text(), '%PDF');
});

test('without a known type the file host’s type is kept', async () => {
  const fetcher: typeof fetch = async () => new Response(new Blob(['x'], { type: 'image/jpeg' }));
  const file = await fetchAsFile('https://bucket/x', { name: 'photo.jpg' }, fetcher);
  assert.equal(file.type, 'image/jpeg');
});

test('a file host refusal is a failure', async () => {
  const fetcher: typeof fetch = async () => new Response('denied', { status: 403 });
  await assert.rejects(fetchAsFile('https://bucket/x', { name: 'a.zip' }, fetcher));
});

/* ── The routing, by source ───────────────────────────────────────────── */

const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const read = (...parts: string[]) => strip(readFileSync(join(process.cwd(), ...parts), 'utf8'));
const hook = read('v2', 'features', 'channels', 'feed', 'use-file-url.ts');
const attachments = read('v2', 'features', 'channels', 'feed', 'MessageAttachments.tsx');
const viewer = read('v2', 'features', 'channels', 'feed', 'MessageImageViewer.tsx');
const fileRow = read('v2', 'features', 'channels', 'files', 'FileRow.tsx');
const sent = read('v2', 'features', 'conversations', 'conversation', 'rows', 'SentAttachments.tsx');

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from);
  assert.ok(start >= 0, from);
  const end = text.indexOf(to, start);
  assert.ok(end > start, to);
  return text.slice(start, end);
};

const saveOr = between(hook, 'const saveOr = (', 'const save = () =>');
const offer = between(hook, 'const offer = async (file: File) =>', 'const saveOr = (');
const open = between(hook, 'const open = (target: T, saveAs?: SaveAs) =>', 'return {');

test('the share path runs only in an installed iOS app that can share the file; anything else takes its own path', () => {
  assert.match(saveOr, /if \(!installedIosApp \|\| !canShareKind\(navigator, saveAs\)\) \{\s*elsewhere\(\);\s*return;\s*\}/);
  assert.ok(saveOr.indexOf('elsewhere();') < saveOr.indexOf('fetchFile.mutate('), 'decided in the tap, before any request');
});

test('a file opened without a name keeps the tab, so pictures never reach the share sheet from a tap', () => {
  assert.match(open, /if \(!saveAs\) \{\s*openInTab\(target\);\s*return;\s*\}/);
  assert.match(open, /shareSheet\.saveOr\(target, saveAs, \(\) => openInTab\(target\)\);/);
});

test('a spent tap holds the fetched file for a second tap; a close or a share puts the card to rest', () => {
  assert.match(offer, /if \(outcome === 'needs-tap'\) \{[\s\S]*?setState\(\{ phase: 'ready', file, holder \}\);/);
  assert.match(offer, /outcome === 'refused' \? \{ phase: 'failed', gone: false \} : \{ phase: 'idle' \}/);
  const save = between(hook, 'const save = () =>', 'return {');
  assert.match(save, /void offer\(state\.file\);/, 'the second tap shares the bytes already fetched');
});

test('a failed mint or download is reported in place, a 404 as gone', () => {
  assert.match(saveOr, /onError: \(error\) => setState\(\{ phase: 'failed', gone: isNotFoundError\(error\) \}\)/);
});

test('the feed file card and the AI chat document chip pass the file name and type', () => {
  assert.match(attachments, /open\(attachment\.id, \{ name: attachment\.original_name, type: attachment\.mime_type \}\)/);
  // A PDF opens in the reader instead, so its row never offers the share sheet's save.
  assert.match(attachments, /onClick=\{ready && !isPdf \? save : openIt\}/);
  assert.match(sent, /openInTab\.open\(document\.file_id, \{ name: document\.file_name, type: document\.mime_type \}\)/);
});

test('picture fallbacks keep the tab: they open without a name', () => {
  assert.match(attachments, /onClick=\{\(\) => open\(attachment\.id\)\}/);
  assert.match(sent, /onClick=\{\(\) => openInTab\.open\(picture\.file_id\)\}/);
  assert.match(viewer, /onClick=\{\(\) => openOriginal\.open\(image\)\}/);
  assert.match(viewer, /openOriginal\.open\(image\);/);
});

test('the Files tab and the viewer Download take the share path, and keep their own path elsewhere', () => {
  assert.match(fileRow, /shareSheet\.saveOr\(file\.id, \{ name: file\.original_name, type: file\.mime_type \}, \(\) =>\s*download\.mutate\(file\.id\),?\s*\)/);
  assert.match(viewer, /shareSheet\.saveOr\(image\.id, \{ name: image\.original_name \}, \(\) =>\s*mutation\.mutate\(image, \{ onError: \(\) => setFailed\(true\) \}\),?\s*\)/);
});

test('the other platforms keep the paths they had', () => {
  const download = between(
    read('v2', 'features', 'channels', 'lists-files-mutations.ts'),
    'export function useDownloadChannelFile()',
    'meta: { silentError: true }',
  );
  assert.match(download, /if \(!window\.open\(url, '_blank', 'noopener'\)\) \{/);
  assert.match(viewer, /anchor\.download = image\.original_name;/);
});
