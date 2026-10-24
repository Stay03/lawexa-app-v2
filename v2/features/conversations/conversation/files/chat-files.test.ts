import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseToolResult, transformApiMessages } from '@/lib/utils/transform-api-messages';
import type { ApiMessage, ToolMessage } from '@/types/chat';
import { parseSidePanelValue, sidePanelValue } from '../side-panel/side-panel-value';
import {
  WORD_PAGES_MAX_BYTES,
  chatFileLine,
  chatFileList,
  fileCountLabel,
  fileListFoot,
  filePanelBody,
  isFileListStep,
  wordPagesFailure,
} from './chat-files';

/* The file list in chat, piece a (Stay, 23 October 2026): the files a Lawexa
 * step listed show as one card, and a tap opens one in the side panel. The
 * shapes below are the server's own (lawexa-api ToolController::listFiles and
 * searchFiles, SpaceToolController::listSpaceContents, read 24 October 2026). */

const here = dirname(fileURLToPath(import.meta.url));
const readHere = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

const at = '2026-10-24T09:00:00Z';
const call = (id: number, tool: string, params: Record<string, unknown> = {}): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role: 'assistant', content: '',
  metadata: { type: 'tool_call', tool_name: tool, tool_parameters: params, iteration: id },
  created_at: at,
});
const stored = (id: number, iteration: number, body: unknown, success = true): ApiMessage => ({
  id, conversation_id: 'c1', agent_id: null, role: 'tool', content: JSON.stringify(body),
  metadata: { type: 'tool_result', iteration, success, latency_ms: 400 },
  created_at: at,
});
const step = (messages: ApiMessage[]) =>
  transformApiMessages(messages).find((m): m is ToolMessage => m.role === 'tool')!;

const space = { uuid: 'b6c1d1f0-0000-4000-8000-000000000001', name: 'TEST DATA Final-year project' };
const citation = (id: number, name: string) => ({
  url: `http://localhost:3000/spaces/${space.uuid}?tab=files&file=${id}`,
  source: { type: 'file', name, space_name: space.name },
});

/** list_files: `mime_type` is the shorthand, the real type is `content_type`. */
const listFilesBody = {
  success: true,
  message: 'Files retrieved successfully.',
  data: {
    scope: `space: ${space.name}`,
    files: [
      {
        id: 812, name: 'Chapter 2 outline - Legal framework.pdf', kind: 'document', mime_type: 'pdf',
        content_type: 'application/pdf', uploader: 'Ada', size_bytes: 1_258_291, size_human: '1.3 MB',
        page_count: 6, char_count: 9000, uploaded_at: at, owner: 'Ada', ...citation(812, 'Chapter 2 outline - Legal framework.pdf'),
      },
      {
        id: 813, name: 'Supervisor feedback.docx', kind: 'document', mime_type: 'docx',
        content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploader: 'Stay',
        size_bytes: 86_016, size_human: '86 KB', page_count: null, char_count: 4000, uploaded_at: at, owner: 'me',
        ...citation(813, 'Supervisor feedback.docx'),
      },
    ],
    pagination: { page: 1, limit: 10, total: 2, has_more: false },
  },
};

/** list_space_contents: the real type is `mime_type`, and the Space is named. */
const spaceContentsBody = {
  success: true,
  message: 'Space contents retrieved successfully.',
  data: {
    space: { ...space, description: null, kind: 'shared', type: 'project', url: `http://localhost:3000/spaces/${space.uuid}` },
    conversations: [],
    folders: [],
    files: Array.from({ length: 7 }, (_, i) => ({
      id: 900 + i, name: i === 0 ? 'Site visit, Ogoni.jpg' : `TEST DATA file ${i}.pdf`,
      kind: i === 0 ? 'image' : 'document', mime_type: i === 0 ? 'image/jpeg' : 'application/pdf',
      size_bytes: 2_516_582, category: i === 0 ? 'image' : 'document', page_count: null, uploader: 'Kemi', uploaded_at: at,
      ...citation(900 + i, 'x'),
    })),
  },
};

test('a list_files step gives one row per file: its name and "type · size · who"', () => {
  const list = chatFileList(step([call(1, 'list_files'), stored(2, 1, listFilesBody)]), null);
  assert.ok(list);
  assert.deepEqual(
    list.rows.map((row) => [row.id, row.name, chatFileLine(row)]),
    [
      [812, 'Chapter 2 outline - Legal framework.pdf', 'PDF · 1.2 MB · Ada'],
      [813, 'Supervisor feedback.docx', 'Word · 84 KB · You'],
    ],
  );
  assert.equal(list.rows[0].view, null);
  assert.equal(list.total, 2);
  assert.equal(list.place, space.name);
  // The result names the Space by name only; Go to Space needs the chat's own Space.
  assert.equal(list.space, null);
  assert.deepEqual(chatFileList(step([call(1, 'list_files'), stored(2, 1, listFilesBody)]), space)?.space, space);
});

test('a list_space_contents step reads the real type and the Space it names', () => {
  const list = chatFileList(step([call(1, 'list_space_contents', { space: space.uuid }), stored(2, 1, spaceContentsBody)]), null);
  assert.ok(list);
  assert.equal(list.rows.length, 7);
  assert.equal(chatFileLine(list.rows[0]), 'Image · 2.4 MB · Kemi');
  assert.equal(list.rows[0].view, 'picture');
  assert.deepEqual(list.space, space);
  assert.equal(fileCountLabel(list.total), '7 files');
  assert.deepEqual(fileListFoot(list, false), { more: 2, unlisted: 0 });
  assert.deepEqual(fileListFoot(list, true), { more: 0, unlisted: 0 });
});

test('a search that counted more files than it listed says how many were left out', () => {
  const body = { success: true, data: { files: listFilesBody.data.files, total: 14, query: 'feedback', scope: 'mine' } };
  const list = chatFileList(step([call(1, 'search_files', { query: 'feedback' }), stored(2, 1, body)]), space);
  assert.ok(list);
  assert.equal(list.total, 14);
  assert.equal(list.place, 'your files');
  assert.equal(list.space, null);
  assert.deepEqual(fileListFoot(list, false), { more: 0, unlisted: 12 });
});

test('no card for a lazy result not loaded yet, a failed step, no files, or another tool', () => {
  const lazy: ApiMessage = { ...stored(2, 1, {}), content: '', has_result: true };
  assert.equal(chatFileList(step([call(1, 'list_files'), lazy]), null), null);
  assert.equal(chatFileList(step([call(1, 'list_files'), stored(2, 1, { success: false, message: 'No such space.' }, false)]), null), null);
  assert.equal(chatFileList(step([call(1, 'list_files'), stored(2, 1, { success: true, data: { files: [] } })]), null), null);
  assert.equal(isFileListStep(step([call(1, 'search_cases'), stored(2, 1, listFilesBody)])), false);
  assert.equal(chatFileList(step([call(1, 'search_cases'), stored(2, 1, listFilesBody)]), null), null);
});

test('a fetched lazy result reads the same as one that came with the chat', () => {
  const fetched = parseToolResult({ content: JSON.stringify(listFilesBody), metadata: { success: true } });
  const lazy: ApiMessage = { ...stored(2, 1, {}), content: '', has_result: true };
  const message = step([call(1, 'list_files'), lazy]);
  const list = chatFileList({ ...message, toolResult: fetched }, null);
  assert.deepEqual(list?.rows.map((row) => row.id), [812, 813]);
});

test('a row without an id is left out, and a repeated id shows once', () => {
  const body = { data: { files: [{ name: 'no id.pdf' }, listFilesBody.data.files[0], listFilesBody.data.files[0]] } };
  const list = chatFileList(step([call(1, 'list_files'), stored(2, 1, body)]), null);
  assert.deepEqual(list?.rows.map((row) => row.id), [812]);
});

test('?side=file:ID names the file the panel opens', () => {
  assert.equal(sidePanelValue({ kind: 'file', id: 812 }), 'file:812');
  assert.deepEqual(parseSidePanelValue('file:812'), { kind: 'file', id: 812 });
  assert.equal(parseSidePanelValue('file:0'), null);
  assert.equal(parseSidePanelValue('file:abc'), null);
  const slot = readHere('..', 'side-panel', 'SidePanelSlot.tsx');
  assert.match(slot, /case 'file':\n\s+return <FilePanel key=\{target\.id\} fileId=\{target\.id\} \/>;/);
  const card = readHere('ChatFileListCard.tsx');
  assert.match(card, /panel\.open\(\{ kind: 'file', id: row\.id \}\)/);
});

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

test('the panel shows pictures, media, Word pages and PDFs itself; the rest go to the placeholder', () => {
  assert.equal(filePanelBody({ mime_type: 'image/jpeg', original_name: 'a.jpg' }), 'picture');
  assert.equal(filePanelBody({ mime_type: 'video/mp4', original_name: 'a.mp4' }), 'video');
  assert.equal(filePanelBody({ mime_type: 'audio/mpeg', original_name: 'a.mp3' }), 'audio');
  assert.equal(filePanelBody({ mime_type: 'application/pdf', original_name: 'a.pdf' }), 'pdf');
  assert.equal(filePanelBody({ mime_type: 'application/zip', original_name: 'a.zip' }), 'other');

  // One switch in the panel: Word pages took `word` (piece c) and the PDF
  // reader took `pdf` (piece b); the placeholder keeps `other`.
  const panel = readHere('FilePanel.tsx');
  assert.match(panel, /case 'word':\n\s+return <WordPages file=\{file\} \/>;/);
  assert.match(panel, /case 'pdf':\n\s+return \(\n\s+<div[^>]*>\n\s+<PdfReader\n/);
  assert.match(panel, /case 'other':\n\s+return <FileDocumentPlaceholder file=\{file\} kind=\{kind\} \/>;/);
  assert.equal(panel.match(/function FileBody\(/g)?.length, 1);
});

/* Piece c (Stay, 23 October 2026): a Word file opens as readable pages, from
 * GET /files/{id}/preview (lawexa-api f98f9d0c, FilePreviewService). */

test('Word pages are asked for exactly the types and sizes the server turns into pages', () => {
  assert.equal(filePanelBody({ mime_type: DOCX, original_name: 'TEST DATA lease.docx', size: 86_016 }), 'word');
  assert.equal(filePanelBody({ mime_type: 'application/msword', original_name: 'old.doc', size: 1000 }), 'word');
  assert.equal(filePanelBody({ mime_type: 'application/rtf', original_name: 'a.rtf' }), 'word');
  assert.equal(filePanelBody({ mime_type: 'text/rtf', original_name: 'a.rtf' }), 'word');
  // The server's own limit: a larger file answers 422, so the panel does not ask.
  assert.equal(filePanelBody({ mime_type: DOCX, original_name: 'big.docx', size: WORD_PAGES_MAX_BYTES }), 'word');
  assert.equal(filePanelBody({ mime_type: DOCX, original_name: 'big.docx', size: WORD_PAGES_MAX_BYTES + 1 }), 'other');
  // The server decides by the stored type, not the name.
  assert.equal(filePanelBody({ mime_type: 'application/octet-stream', original_name: 'a.docx', size: 1000 }), 'other');
});

test("a failed preview says why in the server's words, and offers Try again only when it can help", () => {
  assert.deepEqual(wordPagesFailure(422, 'This file could not be turned into pages.'), {
    message: 'This file could not be turned into pages. You can still download it.',
    retry: false,
  });
  assert.deepEqual(wordPagesFailure(422, 'This file has no page view. Open or download it instead.'), {
    message: 'This file has no page view. Open or download it instead.',
    retry: false,
  });
  assert.equal(wordPagesFailure(403, 'This action is unauthorized.').retry, false);
  assert.equal(wordPagesFailure(404, null).message, 'This file is no longer available.');
  assert.equal(wordPagesFailure(429, 'Too Many Attempts.').retry, true);
  assert.equal(wordPagesFailure(500, 'Server Error').retry, true);
  assert.equal(wordPagesFailure(0, null).message, 'The pages did not load. Try again, or download it.');
});

test("the server's HTML reaches the page only through the notes sanitiser", () => {
  const pages = readHere('WordPages.tsx');
  assert.match(pages, /import \{ NoteContent \} from '@\/v2\/features\/notes\/reader\/NoteContent';/);
  assert.match(pages, /<NoteContent html=\{html\} \/>/);
  assert.doesNotMatch(pages, /dangerouslySetInnerHTML|innerHTML|createContextualFragment/);
  // NoteContent's only input is parseNoteHtml's node tree.
  const content = readHere('..', '..', '..', 'notes', 'reader', 'NoteContent.tsx');
  assert.match(content, /useMemo\(\(\) => parseNoteHtml\(html\), \[html\]\)/);
  assert.doesNotMatch(content, /dangerouslySetInnerHTML=/);
});
