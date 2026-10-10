import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { StatuteAnnotationImage } from '@/types/statute';
import {
  NOTE_IMAGE_CAPTION_MAX,
  NOTE_IMAGE_MAX_BYTES,
  checkImageFiles,
  freshImageUrl,
  imageAlt,
  initialThumbPaint,
  isCaptionChanged,
  isCaptionTooLong,
  moveImage,
  noteImageDetail,
  normalizeCaption,
  orderImages,
  placeInImages,
  roomForImages,
  thumbFailed,
  thumbLoaded,
  thumbRefetched,
  toViewerImages,
} from './images';

const MB = 1024 * 1024;

function file(name: string, type: string, size = MB) {
  return { name, type, size };
}

function image(id: number, url: string, caption: string | null = null): StatuteAnnotationImage {
  return {
    id,
    url,
    original_name: `page-${id}.png`,
    mime_type: 'image/png',
    size_bytes: 1000,
    width: 1200,
    height: 1700,
    caption,
    position: id,
    uploaded_by: { id: 7, name: 'A researcher' },
    created_at: '2026-10-10T09:00:00Z',
  };
}

/* ── The file check ───────────────────────────────────────────────────────── */

test('PNG, JPG and WebP pass; any other type is refused with the reason', () => {
  const checked = checkImageFiles(
    [file('a.png', 'image/png'), file('b.jpg', 'image/jpeg'), file('c.webp', 'image/webp'), file('d.gif', 'image/gif'), file('e.tiff', 'image/tiff')],
    0,
  );
  assert.deepEqual(checked.accepted.map((row) => row.name), ['a.png', 'b.jpg', 'c.webp']);
  assert.deepEqual(checked.refused, [
    { name: 'd.gif', reason: 'd.gif was not added. Use a PNG, JPG or WebP image.' },
    { name: 'e.tiff', reason: 'e.tiff was not added. Use a PNG, JPG or WebP image.' },
  ]);
});

test('a file with no type is judged by its name', () => {
  const checked = checkImageFiles([file('scan.JPEG', ''), file('scan.pdf', '')], 0);
  assert.deepEqual(checked.accepted.map((row) => row.name), ['scan.JPEG']);
  assert.equal(checked.refused[0].name, 'scan.pdf');
});

test('5 MB is the limit: exactly 5 MB passes, one byte more is refused with its size', () => {
  const checked = checkImageFiles(
    [file('ok.png', 'image/png', NOTE_IMAGE_MAX_BYTES), file('big.png', 'image/png', 6.4 * MB)],
    0,
  );
  assert.deepEqual(checked.accepted.map((row) => row.name), ['ok.png']);
  assert.deepEqual(checked.refused, [{ name: 'big.png', reason: 'big.png was not added. It is 6.4 MB and the limit is 5 MB.' }]);
  assert.equal(checkImageFiles([file('over.png', 'image/png', NOTE_IMAGE_MAX_BYTES + 1)], 0).accepted.length, 0);
});

test('a note holds 10: files past the room left are refused, in the order picked', () => {
  const picked = [1, 2, 3, 4].map((n) => file(`p${n}.png`, 'image/png'));
  const checked = checkImageFiles(picked, 8);
  assert.deepEqual(checked.accepted.map((row) => row.name), ['p1.png', 'p2.png']);
  assert.deepEqual(checked.refused, [
    { name: 'p3.png', reason: 'p3.png was not added. A print note holds at most 10 images.' },
    { name: 'p4.png', reason: 'p4.png was not added. A print note holds at most 10 images.' },
  ]);
});

test('a refused file does not use up the room', () => {
  const checked = checkImageFiles([file('bad.gif', 'image/gif'), file('good.png', 'image/png')], 9);
  assert.deepEqual(checked.accepted.map((row) => row.name), ['good.png']);
  assert.equal(checked.refused.length, 1);
});

test('the room left never goes below nothing', () => {
  assert.equal(roomForImages(0), 10);
  assert.equal(roomForImages(7), 3);
  assert.equal(roomForImages(10), 0);
  assert.equal(roomForImages(12), 0);
  assert.equal(checkImageFiles([file('a.png', 'image/png')], 10).accepted.length, 0);
});

/* ── Captions ─────────────────────────────────────────────────────────────── */

test('a caption is trimmed, and an empty one is sent as null', () => {
  assert.equal(normalizeCaption('  Page B41  '), 'Page B41');
  assert.equal(normalizeCaption('   '), null);
  assert.equal(normalizeCaption(''), null);
});

test('120 characters is the limit, counted after the trim', () => {
  const full = 'x'.repeat(NOTE_IMAGE_CAPTION_MAX);
  assert.equal(NOTE_IMAGE_CAPTION_MAX, 120);
  assert.equal(isCaptionTooLong(full), false);
  assert.equal(isCaptionTooLong(`  ${full}  `), false);
  assert.equal(isCaptionTooLong(`${full}x`), true);
});

test('Save shows only when the trimmed draft differs from what is stored', () => {
  assert.equal(isCaptionChanged('Page B41', 'Page B41'), false);
  assert.equal(isCaptionChanged(' Page B41 ', 'Page B41'), false);
  assert.equal(isCaptionChanged('', null), false);
  assert.equal(isCaptionChanged('  ', null), false);
  assert.equal(isCaptionChanged('Page B42', 'Page B41'), true);
  assert.equal(isCaptionChanged('', 'Page B41'), true);
});

/* ── Order ────────────────────────────────────────────────────────────────── */

test('a step up or down gives the new order and the 1-based position to send', () => {
  assert.deepEqual(moveImage([11, 12, 13], 13, -1), { ids: [11, 13, 12], position: 2 });
  assert.deepEqual(moveImage([11, 12, 13], 11, 1), { ids: [12, 11, 13], position: 2 });
  assert.deepEqual(moveImage([11, 12, 13], 12, -1), { ids: [12, 11, 13], position: 1 });
  assert.deepEqual(moveImage([11, 12, 13], 12, 1), { ids: [11, 13, 12], position: 3 });
});

test('a step off either end, or for a picture not there, does nothing', () => {
  assert.equal(moveImage([11, 12, 13], 11, -1), null);
  assert.equal(moveImage([11, 12, 13], 13, 1), null);
  assert.equal(moveImage([11, 12, 13], 99, 1), null);
});

test('a local order shows while a move is on its way; pictures it does not name follow', () => {
  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  assert.deepEqual(orderImages(rows, null).map((row) => row.id), [1, 2, 3, 4]);
  assert.deepEqual(orderImages(rows, [3, 1, 2]).map((row) => row.id), [3, 1, 2, 4]);
  assert.deepEqual(orderImages(rows, [9, 2, 1]).map((row) => row.id), [2, 1, 3, 4]);
});

/* ── Words for a picture ──────────────────────────────────────────────────── */

test('a picture is named by its caption, or else by its file name', () => {
  assert.equal(imageAlt({ caption: 'Section 84(2)(a), gazette page B41', original_name: 'p41.png' }), 'Section 84(2)(a), gazette page B41');
  assert.equal(imageAlt({ caption: null, original_name: 'p41.png' }), 'p41.png');
  assert.equal(imageAlt({ caption: '   ', original_name: 'p41.png' }), 'p41.png');
});

test('the viewer reads the size and caption from a note picture', () => {
  assert.deepEqual(toViewerImages([image(5, 'https://files.test/5', 'Page B41')]), [
    { id: 5, url: 'https://files.test/5', original_name: 'page-5.png', size: 1000, caption: 'Page B41', added_by: 'A researcher' },
  ]);
  assert.equal(toViewerImages([{ ...image(6, 'u6'), uploaded_by: null }])[0].added_by, null);
});

test('the viewer line says who added the picture, then its size; the size alone with no uploader', () => {
  assert.equal(noteImageDetail({ size: 1153434, added_by: 'A researcher' }), 'added by A researcher · 1.1 MB');
  assert.equal(noteImageDetail({ size: 1153434, added_by: null }), '1.1 MB');
  assert.equal(noteImageDetail({ size: 1153434 }), '1.1 MB');
});

/* ── The one retry ────────────────────────────────────────────────────────── */

test('a failed thumbnail fetches fresh links once, then tries the fresh one', () => {
  const start = initialThumbPaint('https://files.test/old');
  assert.deepEqual(start, { src: 'https://files.test/old', status: 'pending', retried: false });

  const first = thumbFailed(start);
  assert.equal(first.refetch, true);
  assert.equal(first.paint.status, 'pending');

  const fresh = thumbRefetched(first.paint, 'https://files.test/new');
  assert.deepEqual(fresh, { src: 'https://files.test/new', status: 'pending', retried: true });
});

test('a second failure is the end: no more fetching, the tile says so', () => {
  const fresh = thumbRefetched(thumbFailed(initialThumbPaint('https://files.test/old')).paint, 'https://files.test/new');
  const second = thumbFailed(fresh);
  assert.equal(second.refetch, false);
  assert.equal(second.paint.status, 'failed');
});

test('a refetch that brings back the same link, or none, is a failure, not an endless wait', () => {
  const waiting = thumbFailed(initialThumbPaint('https://files.test/old')).paint;
  assert.equal(thumbRefetched(waiting, 'https://files.test/old').status, 'failed');
  assert.equal(thumbRefetched(waiting, null).status, 'failed');
});

test('a picture that paints re-arms the retry, so the next expiry recovers too', () => {
  const fresh = thumbRefetched(thumbFailed(initialThumbPaint('https://files.test/old')).paint, 'https://files.test/new');
  const shown = thumbLoaded(fresh);
  assert.deepEqual(shown, { src: 'https://files.test/new', status: 'shown', retried: false });
  assert.equal(thumbFailed(shown).refetch, true);
});

test('the fresh link is found by note and picture id', () => {
  const notes = [
    { uuid: 'n1', images: [image(1, 'https://files.test/1-fresh')] },
    { uuid: 'n2', images: [image(2, 'https://files.test/2-fresh')] },
  ];
  assert.equal(freshImageUrl(notes, 'n2', 2), 'https://files.test/2-fresh');
  assert.equal(freshImageUrl(notes, 'n2', 1), null);
  assert.equal(freshImageUrl(notes, 'gone', 1), null);
  assert.equal(freshImageUrl(undefined, 'n1', 1), null);
});

/* ── The viewer keeps its place ───────────────────────────────────────────── */

test('after a refetch with new links, an open viewer stays on the same picture', () => {
  const before = [image(1, 'https://files.test/1?sig=a'), image(2, 'https://files.test/2?sig=a'), image(3, 'https://files.test/3?sig=a')];
  const place = placeInImages(before, { imageId: 2, index: 1 });
  assert.deepEqual(place, { imageId: 2, index: 1 });

  // A new array, every link signed again: the place is found by id.
  const after = before.map((row) => ({ ...row, url: row.url.replace('sig=a', 'sig=b') }));
  assert.notEqual(after, before);
  assert.deepEqual(placeInImages(after, place), { imageId: 2, index: 1 });
});

test('if the pictures were reordered meanwhile, the viewer follows its picture', () => {
  const after = [image(3, 'u3'), image(1, 'u1'), image(2, 'u2')];
  assert.deepEqual(placeInImages(after, { imageId: 2, index: 1 }), { imageId: 2, index: 2 });
});

test('if its picture was deleted, the viewer stays at the same place, or the last one', () => {
  assert.deepEqual(placeInImages([image(1, 'u1'), image(3, 'u3')], { imageId: 2, index: 1 }), { imageId: 3, index: 1 });
  assert.deepEqual(placeInImages([image(1, 'u1')], { imageId: 3, index: 2 }), { imageId: 1, index: 0 });
});

test('a closed viewer, or a note with no pictures left, has no place', () => {
  assert.equal(placeInImages([image(1, 'u1')], null), null);
  assert.equal(placeInImages([], { imageId: 1, index: 0 }), null);
});
