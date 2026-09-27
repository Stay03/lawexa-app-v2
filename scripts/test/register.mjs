// Loaded with `node --import` by `npm test`: lets Node's own test runner load the
// app's TypeScript modules (see resolve-hooks.mjs).
import { register } from 'node:module';

register('./resolve-hooks.mjs', import.meta.url);
