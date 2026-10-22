import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { UserFile } from '@/types/file';
import type { FolderItemRecord } from '@/v2/features/folders/types';
import { folderItemRow } from '@/v2/features/folders/item-row-model';
import { looseFileRow } from '@/v2/features/folders/loose-file-row-model';
import { filesQueries, MEDIA_URL_STALE_MS } from './queries';
import {
  FILE_LIST_SET,
  listViewable,
  pictureSetAt,
  pictureTarget,
  viewKind,
  viewerImage,
} from './viewable';

/* Stay, 21 October 2026: "files that are viewable should have view/gallery/
 * play ... images should open a gallery, videos should open gallery with
 * 'play', etc should work in folders and space folders". The decision is one
 * pure module, so the Folders page, a folder and a space's files agree. */

test('a picture, a video and a recording open here; a document keeps its tab', () => {
  assert.equal(viewKind({ id: 1, mime_type: 'image/jpeg', original_name: 'exhibit.jpg' }), 'picture');
  assert.equal(viewKind({ id: 1, mime_type: 'image/png', original_name: 'scan.png' }), 'picture');
  assert.equal(viewKind({ id: 1, mime_type: 'image/webp', original_name: 'photo.webp' }), 'picture');
  assert.equal(viewKind({ id: 1, mime_type: 'video/mp4', original_name: 'hearing.mp4' }), 'video');
  assert.equal(viewKind({ id: 1, mime_type: 'video/quicktime', original_name: 'hearing.mov' }), 'video');
  assert.equal(viewKind({ id: 1, mime_type: 'audio/mpeg', original_name: 'call.mp3' }), 'audio');
  // A generic mime still reads the extension for media, as the channel's player does.
  assert.equal(viewKind({ id: 1, mime_type: 'application/octet-stream', original_name: 'call.wav' }), 'audio');
  // Not everything the browser could try: a TIFF is not painted, a PDF is a tab's.
  assert.equal(viewKind({ id: 1, mime_type: 'image/tiff', original_name: 'scan.tiff' }), null);
  assert.equal(viewKind({ id: 1, mime_type: 'application/pdf', original_name: 'bundle.pdf' }), null);
  assert.equal(viewKind({ id: 1, mime_type: 'application/pdf', original_name: 'trick.mp4' }), null);
  assert.equal(
    viewKind({
      id: 1,
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      original_name: 'statement.docx',
    }),
    null,
  );
});

test('no mime, no claim: the unprobed folder payload keeps the open it had', () => {
  assert.equal(viewKind({ id: 1, original_name: 'exhibit.jpg' }), null);
  assert.equal(viewKind({ id: 1, mime_type: null, original_name: 'hearing.mp4' }), null);
  assert.equal(viewKind({ id: 1, mime_type: 'image/jpeg' }), 'picture');
});

test("the list's viewable files, in its order, named and sized from what the payload carried", () => {
  const pictures = listViewable(
    [
      { id: 3, mime_type: 'application/pdf', original_name: 'bundle.pdf', size: 900, url: 'https://x/3' },
      { id: 5, mime_type: 'image/jpeg', original_name: ' exhibit a.jpg ', size: 2048, url: 'https://x/5' },
      { id: 8, mime_type: 'video/mp4', original_name: 'hearing.mp4', size: 7, url: 'https://x/8' },
      { id: 9, mime_type: 'image/png', original_name: '  ', size: Number.NaN, url: null },
      { id: 11, mime_type: 'image/gif', original_name: 'sketch.gif' },
    ],
    'Unnamed file',
  );
  assert.deepEqual(pictures, [
    { id: 5, url: 'https://x/5', original_name: 'exhibit a.jpg', size: 2048 },
    // A video is in the same set, marked so the viewer plays it (Stay, 22
    // October 2026: one viewer for all, "There should be consistency").
    { id: 8, url: 'https://x/8', original_name: 'hearing.mp4', size: 7, kind: 'video' },
    // No link: the viewer's frame mints one BEFORE its first paint (an empty
    // `src` fails nothing, so nothing later could). No size: nothing is claimed.
    { id: 9, url: '', original_name: 'Unnamed file', size: 0 },
    { id: 11, url: '', original_name: 'sketch.gif', size: 0 },
  ]);
  assert.deepEqual(viewerImage({ id: 4, size: -1, url: 'https://x/4' }, 'Scan'), {
    id: 4,
    url: 'https://x/4',
    original_name: 'Scan',
    size: 0,
  });
});

test('the open picture is found by id each time, so a page that loads behind it moves nothing', () => {
  const first = [
    { id: 5, url: '', original_name: 'a.jpg', size: 1 },
    { id: 9, url: '', original_name: 'b.jpg', size: 1 },
  ];
  const target = pictureTarget(9);
  assert.equal(target, `${FILE_LIST_SET}:9`);
  assert.deepEqual(pictureSetAt(first, target), { messageUuid: FILE_LIST_SET, images: first, index: 1 });
  // A page lands after it: the same picture, a longer set.
  const more = [...first, { id: 12, url: '', original_name: 'c.jpg', size: 1 }];
  assert.equal(pictureSetAt(more, target)?.index, 1);
  assert.equal(pictureSetAt(more, target)?.images.length, 3);
  // A row ahead of it leaves: the index follows the picture.
  assert.equal(pictureSetAt(more.slice(1), target)?.index, 0);
  // Gone from the list, closed, malformed, or another set's: nothing.
  assert.equal(pictureSetAt(first, pictureTarget(99)), null);
  assert.equal(pictureSetAt(first, null), null);
  assert.equal(pictureSetAt(first, 'files:'), null);
  assert.equal(pictureSetAt(first, 'message-uuid:9'), null);
});

test('the player link is one shared entry per file, kept under the hour it lasts', () => {
  const options = filesQueries.downloadUrl(7);
  assert.deepEqual(options.queryKey, ['files', 'download-url', 7]);
  assert.equal(MEDIA_URL_STALE_MS, 50 * 60 * 1000);
  assert.equal(options.staleTime, MEDIA_URL_STALE_MS);
  assert.equal(options.retry, false);
  assert.deepEqual(options.meta, { silentError: true });
});

test('a row model says how its file opens', () => {
  const file = (overrides: Partial<UserFile>): UserFile => ({
    id: 7,
    url: null,
    original_name: 'exhibit.jpg',
    mime_type: 'image/jpeg',
    size: 2048,
    category: 'content-image',
    upload_status: 'completed',
    created_at: '2026-10-19T10:00:00Z',
    ...overrides,
  });
  assert.equal(looseFileRow(file({})).view, 'picture');
  assert.equal(looseFileRow(file({ mime_type: 'audio/mpeg', original_name: 'call.mp3' })).view, 'audio');
  assert.equal(looseFileRow(file({ mime_type: 'application/pdf', original_name: 'bundle.pdf' })).view, null);

  const item = (content: Extract<FolderItemRecord, { type: 'file' }>['content']): FolderItemRecord => ({
    id: 40,
    type: 'file',
    added_at: '2026-10-19T10:00:00Z',
    content,
  });
  const picture = folderItemRow(item({ id: 7, original_name: 'exhibit.jpg', mime_type: 'image/jpeg', size: 2048 }));
  assert.equal(picture?.type === 'file' ? picture.view : undefined, 'picture');
  const video = folderItemRow(item({ id: 8, original_name: 'hearing.mp4', mime_type: 'video/mp4' }));
  assert.equal(video?.type === 'file' ? video.view : undefined, 'video');
  // The unprobed shape without a mime: the row opens as it did.
  const bare = folderItemRow(item({ id: 9, original_name: 'exhibit.jpg' }));
  assert.equal(bare?.type === 'file' ? bare.view : undefined, null);
});
