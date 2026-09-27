// Module resolution for `npm test`, matching tsconfig: `@/x` is the repo root,
// and an import with no extension finds x.ts or x/index.ts. Node strips the
// types itself (--experimental-strip-types), so only .ts files load; a test
// must not import a .tsx module.
import { existsSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  let target = specifier.startsWith('@/') ? new URL(specifier.slice(2), ROOT).href : specifier;
  const relative = target.startsWith('.') || target.startsWith('file:');
  if (relative && !/\.[cm]?[jt]s$/.test(target)) {
    const base = new URL(target, context.parentURL).href;
    const found = [`${base}.ts`, `${base}/index.ts`].find((candidate) => existsSync(new URL(candidate)));
    if (found) target = found;
  }
  return nextResolve(target, context);
}
