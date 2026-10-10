import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bodyMountedAfterTransition, bodyMountedOnRender, stepCollapseClass } from './step-collapse-rules';

/* Tool steps without Radix Collapsible (techlead 664f3ac9, 10 October 2026).
 * A closed Radix CollapsibleContent stays mounted and measures itself on mount;
 * 18 closed steps cost a cold chat open 432 ms of style recalcs and pulled the
 * first layout into the commit. These pin that a closed step has no body and
 * that nothing in the step reads layout. No DOM library is installed and tests
 * cannot load .tsx, so the open and close rules are pinned through the
 * functions the component calls, and the component's wiring by its source. */
const here = join(process.cwd(), 'v2', 'features', 'conversations', 'conversation', 'tools');
const source = (file: string) => readFileSync(join(here, file), 'utf8');

test('a closed step renders no body: the region renders children only while mounted, and is inert when closed', () => {
  const s = source('step-collapse.tsx');
  assert.equal(bodyMountedOnRender(false, false), false);
  assert.match(s, /const \[bodyMounted, setBodyMounted\] = useState\(open\);/);
  assert.match(s, /\{mountedNow && children\}/);
  assert.match(s, /inert=\{!open \|\| undefined\}/);
});

test('the region animates height by grid rows: 0fr closed, 1fr open', () => {
  assert.match(stepCollapseClass(false), /grid-rows-\[0fr\]/);
  assert.match(stepCollapseClass(true), /grid-rows-\[1fr\]/);
  assert.match(stepCollapseClass(true), /transition-\[grid-template-rows\] duration-200/);
});

test('opening mounts the body in the same render; closing keeps it until the transition ends', () => {
  assert.equal(bodyMountedOnRender(false, true), true);
  assert.equal(bodyMountedOnRender(true, false), true);
  assert.equal(bodyMountedOnRender(false, false), false);
});

test('the close transition unmounts the body; a transition that ends open keeps it', () => {
  assert.equal(bodyMountedAfterTransition(true, false), false);
  assert.equal(bodyMountedAfterTransition(true, true), true);
});

test('only the region\'s own transition counts, and reduced motion still fires one', () => {
  const s = source('step-collapse.tsx');
  assert.match(s, /if \(event\.target !== event\.currentTarget\) return;/);
  assert.match(s, /setBodyMounted\(\(mounted\) => bodyMountedAfterTransition\(mounted, open\)\)/);
  assert.match(stepCollapseClass(false), /motion-reduce:duration-\[1ms\]/);
  assert.doesNotMatch(stepCollapseClass(false), /transition-none/);
});

test('the step reads no layout and uses no Radix collapsible', () => {
  const step = source('ToolStepItem.tsx');
  const region = source('step-collapse.tsx');
  const rules = source('step-collapse-rules.ts');
  assert.doesNotMatch(step, /components\/ui\/collapsible/);
  assert.match(step, /<StepCollapse id=\{bodyId\} open=\{isExpanded\}>/);
  // Code only: the comments explain the Radix measure by name.
  const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const s of [step, region, rules]) assert.doesNotMatch(code(s), /getBoundingClientRect|offsetHeight|scrollHeight/);
});

test('the step button keeps what the Radix trigger gave: state, target and toggle', () => {
  const step = source('ToolStepItem.tsx');
  assert.match(step, /aria-expanded=\{isExpanded\}/);
  assert.match(step, /aria-controls=\{bodyId\}/);
  assert.match(step, /onClick=\{\(\) => isComplete && onToggle\(\)\}/);
  assert.match(step, /disabled=\{!isComplete\}/);
});
