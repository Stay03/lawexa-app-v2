import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importGraph } from '@/scripts/test/import-graph';

/* A library's loading screen is drawn before the page it stands in for has
 * arrived, and it ships every module its imports reach. Each placeholder lives
 * in a light file of its own, so the cases, statutes, notes and folders
 * boundaries download skeletons and shell shapes, never a screen (speed step 1,
 * 12 October 2026). The markup is pinned by moving it whole; these pin the
 * imports. */
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

/** A screen or a live browser: the modules a loading screen must not reach. */
const SCREEN = /\/[A-Z]\w*(?:Screen|Browser)\.tsx$/;

const BOUNDARIES = [
  'app/v2/cases/loading.tsx',
  'app/v2/cases/(library)/loading.tsx',
  'app/v2/statutes/loading.tsx',
  'app/v2/statutes/(library)/loading.tsx',
  'app/v2/statutes/[slug]/loading.tsx',
  'app/v2/notes/loading.tsx',
  'app/v2/notes/(library)/loading.tsx',
  'app/v2/notes/[slug]/loading.tsx',
  'app/v2/folders/loading.tsx',
  'app/v2/folders/(library)/loading.tsx',
  'app/v2/folders/[uuid]/loading.tsx',
];

for (const boundary of BOUNDARIES) {
  test(`${boundary} reaches no screen module`, () => {
    const screens = importGraph(boundary).files.filter((file) => SCREEN.test(file));
    assert.deepEqual(screens, []);
  });
}

// `app/v2/cases/[slug]/loading.tsx` is left out on purpose: `CaseLoading` draws
// the whole case when the memory cache already holds it, so it needs the screen.

const FALLBACKS = [
  ['v2/features/cases/list', 'CasesFallback', 'CasesScreen'],
  ['v2/features/cases/detail', 'CaseFallback', 'CaseScreen'],
  ['v2/features/statutes/list', 'StatutesFallback', 'StatutesScreen'],
  ['v2/features/statutes/reader', 'StatuteFallback', 'StatuteScreen'],
  ['v2/features/notes/library', 'NotesFallback', 'NotesScreen'],
  ['v2/features/notes/reader', 'NoteFallback', 'NoteScreen'],
  ['v2/features/folders/list', 'FoldersFallback', 'FoldersScreen'],
  ['v2/features/folders/detail', 'FolderDetailFallback', 'FolderScreen'],
] as const;

for (const [dir, fallback, screen] of FALLBACKS) {
  test(`${fallback} is defined in its own file and only there`, () => {
    assert.match(read(dir, `${fallback}.tsx`), new RegExp(`export function ${fallback}\\(\\)`));
    assert.doesNotMatch(read(dir, `${screen}.tsx`), new RegExp(`function ${fallback}\\(`));
  });
}

test('the screens that suspend on their fallback import it from its file', () => {
  for (const [dir, fallback, screen] of FALLBACKS) {
    const source = read(dir, `${screen}.tsx`);
    if (!source.includes(`<${fallback} />`)) continue;
    assert.match(source, new RegExp(`import \\{ ${fallback} \\} from './${fallback}';`), screen);
  }
});
