// The static import graph of an app module, for source pins about what a
// screen downloads. It follows value imports and re-exports the way the
// bundler does (an `import type` brings no code, and neither does a dynamic
// `import()`, which becomes a chunk of its own), resolves `@/` and relative
// specifiers like tsconfig, and stops at packages. A pin can then ask which
// app files a route reaches and whether any of them imports a given package.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

function resolveFile(specifier: string, from: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const extension of EXTENSIONS) if (existsSync(base + extension)) return base + extension;
  return null;
}

/** True when every name in an `{ ... }` clause is marked `type`. */
function typeOnlyClause(clause: string): boolean {
  if (clause.startsWith('type ')) return true;
  const named = clause.match(/^\{([^}]*)\}$/);
  if (!named) return false;
  const names = named[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return names.length > 0 && names.every((name) => name.startsWith('type '));
}

/** The specifiers a file's static value imports and re-exports name. */
export function staticImports(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const found: string[] = [];
  for (const match of code.matchAll(/(?:^|\n)\s*(?:import|export)\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/g)) {
    if (!typeOnlyClause(match[1].trim())) found.push(match[2]);
  }
  for (const match of code.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)) found.push(match[1]);
  return found;
}

export interface ImportGraph {
  /** Every app file reached, as repo-relative paths with forward slashes. */
  files: string[];
  /** Every package specifier imported by a reached file, with the importer. */
  packages: { specifier: string; from: string }[];
}

/** Walks the static graph from repo-relative entry files. */
export function importGraph(...entries: string[]): ImportGraph {
  const seen = new Set<string>();
  const packages: ImportGraph['packages'] = [];
  const queue = entries.map((entry) => join(ROOT, entry));
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of staticImports(readFileSync(file, 'utf8'))) {
      const next = resolveFile(specifier, file);
      if (next) {
        if (!seen.has(next)) queue.push(next);
      } else if (!specifier.startsWith('.') && !specifier.startsWith('@/')) {
        packages.push({ specifier, from: toRepoPath(file) });
      }
    }
  }
  return { files: [...seen].map(toRepoPath), packages };
}

function toRepoPath(file: string): string {
  return relative(ROOT, file).split('\\').join('/');
}
