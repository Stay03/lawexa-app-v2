import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* The wiring behind `viewable.ts` (Stay, 21 October 2026): a picture, a video
 * and a recording open the ONE full-screen viewer over their list, the video
 * or recording playing where a picture would sit (Stay, 22 October 2026: "The
 * image viewer and video player looks like different things ... There should
 * be consistency"), and every other file keeps the open it had, on the
 * Folders page, in a folder, and in a space's files and file card. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');
const readFeature = (...parts: string[]) => read('..', ...parts);

test('one player: the browser controls, no autoplay, one fresh link per failure, shared by key', () => {
  const player = read('MediaPlayer.tsx');
  assert.match(player, /useQuery\(filesQueries\.downloadUrl\(file\.id\)\)/);
  assert.match(player, /<video[\s\S]*?controls[\s\S]*?playsInline[\s\S]*?preload="metadata"/);
  assert.match(player, /<audio[\s\S]*?controls[\s\S]*?preload="metadata"/);
  assert.doesNotMatch(player, /autoPlay|autoplay/);
  // An expired link is minted afresh once; the same link again is a failure.
  assert.match(player, /setRetried\(true\);\s*void link\.refetch\(\)\.then\(/);
  assert.match(player, /if \(fresh === null \|\| fresh === src\) \{\s*setFailed\(true\);\s*return;\s*\}\s*setSrc\(fresh\);/);
  assert.match(player, /if \(failed \|\| link\.isError\) return <>\{failure\}<\/>;/);
  // The player adopts the query's link once and owns it from there: the
  // query's own refetch (a tab brought back after 50 minutes) must not rebuild
  // the element, keyed by `src`, under a play.
  assert.match(player, /const \[src, setSrc\] = useState<string \| null>\(null\);/);
  assert.match(player, /if \(src === null && minted !== null\) setSrc\(minted\);/);
  assert.doesNotMatch(player, /const src = link\.data/);
  assert.doesNotMatch(player, /useEffect/);
  // A play that reaches its metadata re-arms the one refresh.
  assert.match(player, /onLoadedMetadata=\{\(\) => setRetried\(false\)\}/);
  // The skeleton stands where the player will, and holds still for reduced motion.
  assert.match(player, /animate-pulse rounded-lg bg-muted motion-reduce:animate-none/);
});

test("a video or a recording plays inside the viewer, where a picture sits, with the row's old open as the way out", () => {
  const media = read('ViewerMedia.tsx');
  assert.match(media, /<MediaPlayer file=\{file\} kind="video" failure=\{failure\} className="max-h-\[calc\(100dvh-9rem\)\]" \/>/);
  // A recording has no picture: a centred card with its name over the player.
  assert.match(media, /if \(file\.kind === 'audio'\) \{[\s\S]*?mx-auto flex w-full max-w-md[\s\S]*?\{file\.original_name\}[\s\S]*?<MediaPlayer file=\{file\} kind="audio" failure=\{failure\} \/>/);
  assert.match(media, /const openInTab = useShowFileInNewTab\(\);/);
  assert.match(media, /didn&rsquo;t play here\./);
  assert.match(media, /Open in a new tab/);
  assert.match(media, /This file is no longer available\./);
  // The separate player dialog is gone: one viewer for all.
  assert.throws(() => read('MediaPlayerDialog.tsx'));

  const viewer = readFeature('channels', 'feed', 'MessageImageViewer.tsx');
  // Only the file on screen is mounted, so a swipe away stops it.
  assert.match(viewer, /isViewerMedia\(image\) && source\.renderMedia \? \([\s\S]{0,300}?position === index && <div className="w-full max-w-3xl">\{source\.renderMedia\(image\)\}<\/div>/);
  // The player keeps its own presses and arrow keys: its slider seeks, not swipes.
  assert.match(viewer, /if \(event\.target instanceof Element && event\.target\.closest\('video, audio'\)\) return;\s*if \(event\.key === 'ArrowRight'\)/);
  assert.match(viewer, /if \(event\.pointerType === 'mouse' && event\.button !== 0\) return;[\s\S]{0,200}?if \(event\.target instanceof Element && event\.target\.closest\('video, audio'\)\) return;/);
  // A mixed set says "file"; a picture set still says "picture".
  assert.match(viewer, /const noun = images\.some\(isViewerMedia\) \? 'file' : 'picture';/);
  assert.match(viewer, /label=\{`Previous \$\{noun\}`\}/);
});

test("the viewers under a list: the channel's picture viewer with the list's words, and the player", () => {
  const viewers = read('FileViewers.tsx');
  assert.match(
    viewers,
    /<PictureViewer\s+open=\{viewer\.picture !== null\}\s+set=\{set\}\s+resolving=\{false\}\s+onSelect=\{viewer\.setPicture\}\s+onClose=\{\(\) => viewer\.setPicture\(null\)\}\s+source=\{PICTURE_SOURCE\[place\]\}\s+returnFocusTo=\{viewer\.returnTo\}/,
  );
  assert.doesNotMatch(viewers, /MediaPlayerDialog/);
  assert.match(viewers, /const renderMedia: PictureSource\['renderMedia'\] = \(file\) => <ViewerMedia file=\{file\} \/>;/);
  // Held in state, never bound to the address: the viewer must not promise Back.
  assert.doesNotMatch(viewers, /closesOnBack|useUrlOverlay/);
  // Held through the exit; the set follows the picture by id.
  assert.match(viewers, /const shown = useHeldValue\(viewer\.picture\);/);
  assert.match(viewers, /pictureSetAt\(pictures, shown\)/);
  // Open original shows the picture in its tab (the file row's `inline`).
  assert.match(viewers, /filesApi\.getDownloadUrl\(image\.id, \{ inline: true \}\)/);
  for (const place of ['files', 'folder', 'space']) {
    assert.match(
      viewers,
      new RegExp(`^  ${place}: \\{\\n    freshUrl: freshInlineUrl,\\n    linkKey: INLINE_LINK_KEY,\\n    download: true,\\n    detail: sizeDetail,\\n    renderMedia,`, 'm'),
      place,
    );
  }
  const hook = read('use-file-viewer.ts');
  assert.match(hook, /setPicture\(pictureTarget\(file\.id\)\);/);
  // Every kind opens the same viewer: there is no second, media-only state.
  assert.doesNotMatch(hook, /setMedia|media:/);
  // Where focus goes back: the element the host named, else the pressed control.
  assert.match(hook, /const pressed = returnFocusTo \?\? document\.activeElement;\s*setReturnTo\(pressed instanceof HTMLElement \? pressed : null\);/);
});

test("the channel's viewer, as a file list uses it: a first link for a row without one, Escape alone, no stray separator", () => {
  const viewer = readFeature('channels', 'feed', 'MessageImageViewer.tsx');
  // A picture whose row carried no link: React drops an empty `src`, so no
  // `error` could ever start the refresh. The first link is a query, enabled
  // only then, adopted once; the `<img>` is only ever given a link.
  assert.match(viewer, /queryKey: \['picture-viewer', 'first-link', source\.linkKey, image\.id\] as const,/);
  assert.match(viewer, /enabled: src === '',/);
  assert.match(viewer, /if \(src === '' && firstLink\.data !== undefined\) setSrc\(firstLink\.data\);/);
  assert.match(viewer, /if \(paint === 'failed' \|\| firstLink\.isError\) \{/);
  assert.match(viewer, /\{src !== '' && \(\s*\/\/ eslint-disable-next-line @next\/next\/no-img-element[^\n]*\n\s*<img\s+key=\{src\}\s+src=\{src\}/);
  assert.doesNotMatch(viewer, /useEffect/);
  // Back closes only the channel's viewer, which is in the address.
  assert.match(viewer, /const dismiss = closesOnBack \? 'Escape or Back' : 'Escape';/);
  assert.match(viewer, /Press \$\{dismiss\} to return to \$\{source\.words\.returnTo\}\./);
  assert.doesNotMatch(viewer, /Escape or Back to return/);
  assert.match(viewer, /onClose=\{onClose\}\s+closesOnBack\s*\/>/);
  // "2 of 5" stands alone when the source has no detail for the picture.
  assert.match(viewer, /\{index \+ 1\} of \{count\}\s*\{detail \? ' · ' : ''\}/);
  assert.doesNotMatch(viewer, /\{image \? ' · ' : ''\}/);
  // The caller's element stands in for an opener that closes with its frame.
  assert.match(viewer, /const opener = returnFocusTo \?\? document\.activeElement;/);
  // Every source names its link cache; the three id spaces stay apart.
  const source = readFeature('channels', 'feed', 'picture-source.ts');
  assert.match(source, /linkKey: string;/);
  assert.match(source, /linkKey: 'file',/);
  assert.match(readFeature('statutes', 'notes', 'NoteImages.tsx'), /linkKey: 'print-note',/);
});

test('a file row opens here when its host says how, and in a tab otherwise', () => {
  const entry = readFeature('folders', 'file-list', 'FileEntryRow.tsx');
  assert.match(entry, /onClick=\{onView \?\? \(\(\) => open\(fileId\)\)\}/);
  assert.match(entry, /aria-haspopup=\{onView \? 'dialog' : undefined\}/);
  for (const row of [['folders', 'list', 'LooseFileRow.tsx'], ['folders', 'detail', 'FolderItemRow.tsx']]) {
    assert.match(readFeature(...row), /onView=\{row\.view \? \(\) => onView\(row\) : undefined\}/, row.join('/'));
  }
  assert.match(readFeature('folders', 'loose-file-row-model.ts'), /view: viewKind\(file\),/);
  assert.match(readFeature('folders', 'item-row-model.ts'), /view: viewKind\(content\),/);
});

test("the Folders page's loose files: one viewer over the list's viewable files, in its order", () => {
  const section = readFeature('folders', 'list', 'LooseFilesSection.tsx');
  assert.match(section, /const viewer = useFileViewer\(\);/);
  assert.match(section, /pictures: listViewable\(files, UNNAMED_FILE\)/);
  assert.match(section, /if \(row\.view\) view\(\{ id: row\.id, name: row\.title, kind: row\.view \}\);/);
  assert.match(section, /<LooseFileRow[\s\S]*?onView=\{openView\}/);
  assert.match(section, /<FileViewers viewer=\{viewer\} pictures=\{pictures\} place="files" \/>/);
});

test("a folder, personal or a space's: the stream's viewable files, less a removal in flight", () => {
  const screen = readFeature('folders', 'detail', 'FolderScreen.tsx');
  assert.match(screen, /const viewer = useFileViewer\(\);/);
  assert.match(
    screen,
    /mapped\.push\(row\);\s*if \(item\.type === 'file' && row\.type === 'file' && row\.view && row\.view !== 'pdf'\) \{\s*shownPictures\.push\(viewerImage\(item\.content, row\.title, row\.view\)\);/,
  );
  assert.match(screen, /if \(row\.view\) view\(\{ id: row\.contentId, name: row\.title, kind: row\.view \}\);/);
  assert.match(screen, /<FolderItemRow[\s\S]*?onView=\{openView\}/);
  assert.match(screen, /<FileViewers viewer=\{viewer\} pictures=\{pictures\} place="folder" \/>/);
});

test("a space's file card offers View or Play first, closes, and the feed opens the viewer", () => {
  const card = readFeature('spaces', 'detail', 'content', 'SpaceFileCard.tsx');
  assert.match(card, /const kind = viewKind\(file\);/);
  assert.match(card, /close\(\);\s*onView\(file, kind\);/);
  assert.match(card, /\{kind === 'picture' \? 'View' : kind === 'pdf' \? 'Read' : 'Play'\}/);
  // "Open file" steps back to the outline only when View or Play is there.
  assert.match(card, /variant=\{kind \? 'outline' : 'default'\}/);
  // The inline player is the shared one; the card mints no link of its own.
  assert.match(card, /<MediaPlayer\s+file=\{file\}\s+kind=\{kind\}/);
  assert.doesNotMatch(card, /useQuery|download-url|MEDIA_URL_STALE_MS/);

  const panel = readFeature('spaces', 'detail', 'content', 'SpaceContentPanel.tsx');
  assert.match(panel, /const viewer = useFileViewer\(\);/);
  assert.match(panel, /for \(const entry of items\) if \(entry\.type === 'file'\) files\.push\(entry\.item\);\s*return listViewable\(files, 'File'\);/);
  assert.match(panel, /onView=\{viewFile\}\s*\/>\s*<FileViewers viewer=\{viewer\} pictures=\{pictures\} place="space" \/>/);
  // The card's button is gone by the close: focus goes back to the row it hung from.
  assert.match(panel, /const cardRow = card\?\.row \?\? null;/);
  assert.match(
    panel,
    /view\(\{ id: file\.id, name: file\.original_name, kind, mimeType: file\.mime_type, size: file\.size \}, cardRow\),\s*\[view, cardRow\],/,
  );
});
