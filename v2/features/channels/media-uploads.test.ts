import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  FILE_ACCEPT_ATTR,
  FILE_ALLOWED_EXTENSIONS,
  FILE_MAX_SIZE_BYTES,
  MEDIA_MAX_SIZE_BYTES,
  validateChannelFile,
} from './model';
import { fileKind, playableKind } from './files/file-model';

/* Video and audio in channels and threads (Stay, 20 October 2026; backend's
 * rule): mp4, mov, webm, mp3, m4a, wav and ogg up to 100 MB, everything else
 * still 15 MB. The client matches the server so a file it would refuse is
 * never uploaded. */

const MB = 1024 * 1024;
const fileOf = (name: string, size: number, type = '') => new File([new ArrayBuffer(size)], name, { type });

test('the picker and the check take the seven media types', () => {
  for (const ext of ['mp4', 'mov', 'webm', 'mp3', 'm4a', 'wav', 'ogg']) {
    assert.ok((FILE_ALLOWED_EXTENSIONS as readonly string[]).includes(ext), ext);
    assert.ok(FILE_ACCEPT_ATTR.split(',').includes(`.${ext}`), ext);
  }
  // Names the server does not list stay refused.
  for (const name of ['clip.m4v', 'note.aac', 'voice.opus', 'tune.oga']) {
    assert.match(validateChannelFile(fileOf(name, 10)) ?? '', /isn't a supported file type/);
  }
});

test('video and audio may be up to 100 MB; documents, pictures and zips stay at 15 MB', () => {
  assert.equal(MEDIA_MAX_SIZE_BYTES, 100 * MB);
  assert.equal(FILE_MAX_SIZE_BYTES, 15 * MB);
  assert.equal(validateChannelFile(fileOf('hearing.mp4', 100 * MB)), null);
  assert.equal(validateChannelFile(fileOf('memo.m4a', 40 * MB)), null);
  assert.equal(validateChannelFile(fileOf('hearing.mp4', 100 * MB + 1)), '"hearing.mp4" is larger than 100 MB.');
  assert.equal(validateChannelFile(fileOf('bundle.pdf', 15 * MB + 1)), '"bundle.pdf" is larger than 15 MB.');
  assert.equal(validateChannelFile(fileOf('bundle.zip', 15 * MB)), null);
});

test('a video or audio file plays in the message; its kind reads from the mime, the name as fallback', () => {
  assert.equal(playableKind({ mime_type: 'video/mp4', original_name: 'a.mp4' }), 'video');
  assert.equal(playableKind({ mime_type: 'video/quicktime', original_name: 'a.mov' }), 'video');
  assert.equal(playableKind({ mime_type: 'audio/mpeg', original_name: 'a.mp3' }), 'audio');
  assert.equal(playableKind({ mime_type: 'audio/x-m4a', original_name: 'a.m4a' }), 'audio');
  assert.equal(playableKind({ mime_type: 'application/octet-stream', original_name: 'call.wav' }), 'audio');
  assert.equal(playableKind({ mime_type: 'application/pdf', original_name: 'a.pdf' }), null);
  assert.equal(playableKind({ mime_type: 'application/pdf', original_name: 'trick.mp4' }), null);
  assert.equal(fileKind({ mime_type: 'video/webm', original_name: 'a.webm' }), 'video');
  assert.equal(fileKind({ mime_type: 'audio/ogg', original_name: 'a.ogg' }), 'audio');
});

test('the player has the browser controls, no autoplay, and keeps the file row for Download', () => {
  const source = readFileSync(join(process.cwd(), 'v2', 'features', 'channels', 'feed', 'MessageAttachments.tsx'), 'utf8');
  const player = source.slice(source.indexOf('function MediaAttachment'), source.indexOf('function FileAttachment'));
  assert.match(player, /<video[\s\S]*?controls[\s\S]*?playsInline[\s\S]*?preload="metadata"/);
  assert.match(player, /<audio[\s\S]*?controls[\s\S]*?preload="metadata"/);
  assert.doesNotMatch(player, /autoPlay|autoplay/);
  assert.match(player, /<FileAttachment attachment=\{attachment\} \/>/);
  // An expired link is minted afresh once, then the failure is said in place.
  assert.match(player, /refreshedRef\.current = true;\s*refresh\.mutate\(attachment\.id/);
});
