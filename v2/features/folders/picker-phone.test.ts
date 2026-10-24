import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { sheetEnterAction } from './picker/picker-keys';
import {
  createDebounce,
  createRowFirst,
  keepWithinLevel,
  pickerListState,
  SEARCH_DEBOUNCE_MS,
  type DebounceTimers,
} from './picker/picker-search';

/* The folder picker on a phone (Arthur's iPhone recording, 24 October 2026,
 * "Save to Space folder" from a saved chat draft): the sheet jumped with the
 * keyboard, "Create 'Employment Folder'" sat under the keyboard, the words
 * lagged the field ("No folder matches 'E'" under "Emp"), skeleton rows
 * flashed on every key, and two dim layers stacked over the draft. */

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, ...parts), 'utf8').replace(/\r\n/g, '\n');

/** A clock the test moves by hand. */
function fakeTimers() {
  let now = 0;
  let next = 1;
  const waiting = new Map<number, { at: number; run: () => void }>();
  const timers: DebounceTimers = {
    set: (run, ms) => {
      const id = next++;
      waiting.set(id, { at: now + ms, run });
      return id;
    },
    clear: (handle) => {
      waiting.delete(handle as number);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const [id, entry] of [...waiting]) {
      if (entry.at <= now) {
        waiting.delete(id);
        entry.run();
      }
    }
  };
  return { timers, advance };
}

test('the search waits about 250 ms after the last key, and only the last words are asked', () => {
  assert.equal(SEARCH_DEBOUNCE_MS, 250);
  const asked: string[] = [];
  const clock = fakeTimers();
  const debounce = createDebounce((value) => asked.push(value), SEARCH_DEBOUNCE_MS, clock.timers);
  debounce.push('E');
  clock.advance(100);
  debounce.push('Em');
  clock.advance(100);
  debounce.push('Emp');
  clock.advance(249);
  assert.deepEqual(asked, []);
  clock.advance(1);
  assert.deepEqual(asked, ['Emp']);
});

test('flush asks now and drops the wait; cancel asks nothing', () => {
  const asked: string[] = [];
  const clock = fakeTimers();
  const debounce = createDebounce((value) => asked.push(value), 250, clock.timers);
  debounce.push('Emplo');
  debounce.flush('Employ');
  clock.advance(500);
  assert.deepEqual(asked, ['Employ']);
  debounce.push('Employm');
  debounce.cancel();
  clock.advance(500);
  assert.deepEqual(asked, ['Employ']);
});

test('a new search in the same level keeps the last answer; another level does not', () => {
  const kept = { pages: ['root rows'] };
  const keep = keepWithinLevel(null);
  const ownKey = ['folders', 'list', { parentUuid: null, search: 'Em' }, { viewerId: 4 }];
  const spaceKey = ['spaces', 'contents', 's-1', 'folders', { parentUuid: null, search: null }, { viewerId: 4 }];
  assert.equal(keep(kept, { queryKey: ownKey }), kept);
  assert.equal(keep(kept, { queryKey: spaceKey }), kept);
  // A drill: the folder just left is not what is inside the one just opened.
  const drilled = ['folders', 'list', { parentUuid: 'f-1', search: null }, { viewerId: 4 }];
  assert.equal(keep(kept, { queryKey: drilled }), undefined);
  assert.equal(keepWithinLevel('f-1')(kept, { queryKey: ownKey }), undefined);
  assert.equal(keep(kept, undefined), undefined);
  assert.equal(keep(undefined, { queryKey: ownKey }), undefined);
});

test('only the answer for the words in the field counts as the answer', () => {
  // The first load: skeleton, no spinner.
  assert.deepEqual(
    pickerListState({ isPending: true, isFetching: true, isPlaceholderData: false, input: '', query: '' }),
    { skeleton: true, searching: false, answersTyped: false },
  );
  // Typed, the pause still running: the last rows stay, the spinner shows.
  assert.deepEqual(
    pickerListState({ isPending: false, isFetching: false, isPlaceholderData: false, input: 'Emp', query: 'E' }),
    { skeleton: false, searching: true, answersTyped: false },
  );
  // Asked, the answer not back: still the old rows, still the spinner.
  assert.deepEqual(
    pickerListState({ isPending: false, isFetching: true, isPlaceholderData: true, input: 'Emp', query: 'Emp' }),
    { skeleton: false, searching: true, answersTyped: false },
  );
  // Answered.
  assert.deepEqual(
    pickerListState({ isPending: false, isFetching: false, isPlaceholderData: false, input: 'Emp ', query: 'Emp' }),
    { skeleton: false, searching: false, answersTyped: true },
  );
});

test('with nothing matching on the phone, the create row comes first', () => {
  assert.equal(createRowFirst(0, 'Employment Folder'), true);
  assert.equal(createRowFirst(0, '   '), false);
  assert.equal(createRowFirst(0, ''), false);
  assert.equal(createRowFirst(2, 'Emp'), false);
  const body = read('picker', 'PickerBody.tsx');
  assert.match(body, /const createFirst = !isDialog && createRowFirst\(folders\.length, typedName\);/);
  // Under the field and above the empty words, and not again at the bottom.
  const first = body.indexOf('{createFirst ? (');
  const empty = body.indexOf('<EmptyLevel');
  assert.ok(first > body.indexOf('<Input') && first < empty);
  assert.match(body, /\{createFirst \? null : <CreateRow view=\{createRow\} onActivate=\{activateCreate\} \/>\}/);
});

test("the phone's go key creates when nothing matches, picks a single match, and otherwise does nothing", () => {
  const settled = { answersTyped: true, input: 'Employment Folder', committedSearch: 'Employment Folder' };
  assert.deepEqual(sheetEnterAction({ ...settled, folderUuids: [] }), { kind: 'create', name: 'Employment Folder' });
  assert.deepEqual(sheetEnterAction({ ...settled, folderUuids: ['f-1'] }), { kind: 'choose', uuid: 'f-1' });
  assert.deepEqual(sheetEnterAction({ ...settled, folderUuids: ['f-1', 'f-2'] }), { kind: 'none' });
  // Nothing typed: go cannot say which row was meant.
  assert.deepEqual(
    sheetEnterAction({ answersTyped: true, input: '', committedSearch: '', folderUuids: ['f-1'] }),
    { kind: 'none' },
  );
  // The list is behind the field: commit the search first.
  assert.deepEqual(
    sheetEnterAction({ answersTyped: false, input: 'Employment', committedSearch: 'Emp', folderUuids: [] }),
    { kind: 'commit-search' },
  );
  // Asked but not answered: the old rows are not this search's answer.
  assert.deepEqual(
    sheetEnterAction({ answersTyped: false, input: 'Employment', committedSearch: 'Employment', folderUuids: [] }),
    { kind: 'none' },
  );
  const body = read('picker', 'PickerBody.tsx');
  assert.match(body, /onKeyDown=\{isDialog \? onKeyDown : onSheetKeyDown\}/);
});

test('the words and the spinner read the field, and the skeleton shows on the first load only', () => {
  const body = read('picker', 'PickerBody.tsx');
  assert.match(body, /<EmptyLevel\s+here=\{here\}\s+search=\{typedName\}/);
  assert.match(body, /placeholderData: keepWithinLevel\(parentUuid\),[\s\S]*placeholderData: keepWithinLevel\(parentUuid\),/);
  assert.match(body, /\{listState\.skeleton \? \(\s*<PickerRowsSkeleton \/>/);
  assert.match(body, /\{listState\.searching \? \(\s*<Loader2/);
  // The dialog's Enter never acts on rows kept from the last search.
  assert.match(body, /listReady: listReady && !level\.isPlaceholderData,/);
});

test('the phone sheet is placed from the visible rectangle, whole above the keyboard', () => {
  const picker = read('picker', 'FolderPicker.tsx');
  assert.match(
    picker,
    /className="top-\[calc\(var\(--visual-top,0px\)\+var\(--visual-height,100dvh\)\)\] max-h-\[calc\(var\(--visual-height,100dvh\)-2\.5rem\)\] -translate-y-full /,
  );
  assert.match(picker, /style=\{\{ bottom: 'auto' \}\}/);
  assert.doesNotMatch(picker, /bottom: 'var\(--keyboard-inset/);
  assert.doesNotMatch(picker, /max-h-\[88dvh\]/);
});

test('over the chat side panel the picker adds no second dim layer', () => {
  const picker = read('picker', 'FolderPicker.tsx');
  assert.match(
    picker,
    /overlayClassName="\[\[data-v2-side-panel\]_&\]:bg-transparent \[\[data-v2-side-panel\]_&\]:backdrop-blur-none"/,
  );
  // The attribute the panel sets on <html> while it is open.
  const panel = read('..', 'conversations', 'conversation', 'side-panel', 'ChatSidePanel.tsx');
  assert.match(panel, /root\.setAttribute\('data-v2-side-panel', ''\);/);
  // The desktop dialog is untouched.
  assert.match(picker, /<DialogContent className="gap-4 sm:max-w-lg" onEscapeKeyDown=\{escape\}>/);
});
