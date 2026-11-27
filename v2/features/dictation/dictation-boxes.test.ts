import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/*
 * Arthur, 26 November 2026 (thread ce4eb347): "check that all chat box has it",
 * and "the chat box expands … outside the borders of the screen". Every message
 * box dictates, behind the same `can_dictate` gate, and no box grows past its
 * cap, which also follows the screen's height (a phone with its keyboard up).
 */

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');
const BOXES: Record<string, string[]> = {
  'the chat page and case chat': ['v2', 'features', 'conversations', 'conversation', 'ConversationComposer.tsx'],
  'the homepage and the Space chat dock': ['v2', 'shell', 'designs', 'HomeComposer.tsx'],
  'Space channels and task threads': ['v2', 'features', 'channels', 'composer', 'ChannelComposer.tsx'],
  'the agent panel': ['v2', 'features', 'conversations', 'conversation', 'agents', 'AgentConversationPanel.tsx'],
};
/** Boxes that are not message boxes, and why. */
const NOT_A_MESSAGE_BOX: Record<string, string> = {
  'v2/features/channels/lists/ListDetail.tsx': 'AddItemComposer adds a list item (Techlead, 26 November 2026)',
};

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });

test('every message box offers Dictate, from the one button, behind can_dictate', () => {
  for (const [where, path] of Object.entries(BOXES)) {
    const box = read(...path);
    assert.match(box, /import \{ DictateButton \} from '@\/v2\/features\/dictation\/DictateButton';/, where);
    assert.match(box, /<DictateButton\b/, where);
    assert.match(box, /useDictation\(\{/, where);
    assert.match(box, /<DictationPanel\s+state=\{dictating\}\s+dictation=\{dictation\}/, where);
    assert.match(box, /<DictationCountdown state=\{dictating\} dictation=\{dictation\} \/>/, where);
    assert.match(box, /<DictationHint state=\{dictating\} \/>/, where);
    // The gate: the session's can_dictate, in the line that offers it.
    assert.match(box, /const dictatePlace = dictateOffer\([\s\S]{0,30}\b(canDictate|dictable)\b/, where);
    assert.match(box, /const offerDictate = dictatePlace === 'instead';/, where);
    // A box that takes files: with only files attached the mic sits beside Send,
    // and files can be added while dictating or paused.
    if (where === 'the agent panel') continue;
    assert.match(box, /\{dictatePlace === 'beside'[\s\S]{0,160}<DictateButton/, where);
    assert.match(box, /onAttach=\{\(\) => fileInputRef\.current\?\.click\(\)\}/, where);
  }
  // The channel box asks where the reader may post.
  assert.match(read(...BOXES['Space channels and task threads']), /const dictable = canDictate && channel\.can_post !== false;/);
});

test('no message box in v2 is left without Dictate', () => {
  const composers = walk(join(ROOT, 'v2'))
    .map((file) => relative(ROOT, file).split(sep).join('/'))
    // A component (a capital first letter), not a hook such as useHomeComposer.
    .filter((file) => /function [A-Z]\w*Composer\(/.test(readFileSync(join(ROOT, file), 'utf8')))
    .filter((file) => !(file in NOT_A_MESSAGE_BOX));
  const known = new Set(Object.values(BOXES).map((parts) => parts.join('/')));
  assert.deepEqual(composers.filter((file) => !known.has(file)), [], 'a message box not in BOXES: give it Dictate, or say why not');
});

test('the voice goes where the route keeps it: the chat page and the homepage, never in a private mode', () => {
  const home = read(...BOXES['the homepage and the Space chat dock']);
  assert.match(home, /const voiceKept = keepsVoice\(\{ isConfidential: confidential, isRedacted: redacted \}\);/);
  assert.match(home, /if \(clip && voiceKept\) \{/);
  assert.match(home, /\.\.\.\(voiceClipId !== undefined && \{ voiceClipId \}\),/);
  const start = read('v2', 'features', 'conversations', 'start-conversation.ts');
  assert.match(start, /\.\.\.\(input\.voiceClipId !== undefined && !confidential && !redacted && \{ voice_clip_id: input\.voiceClipId \}\),/);
  // Channel messages and the agent's route take no voice: the words go alone.
  for (const where of ['Space channels and task threads', 'the agent panel']) {
    assert.doesNotMatch(read(...BOXES[where]), /uploadClip|voice_clip_id|voiceClip/, where);
  }
});

test('no box grows past its cap, and the cap follows the screen height', () => {
  const panel = read('v2', 'features', 'dictation', 'DictationPanel.tsx');
  // The live words and the paused words: a third of the screen at most, long words wrap.
  assert.equal((panel.match(/max-h-\[min\(150px,30dvh\)\]/g) ?? []).length, 2);
  assert.equal((panel.match(/\[overflow-wrap:anywhere\]/g) ?? []).length, 2);
  // SIDEWAYS (Arthur's recording, iPhone): the panel is its box's width, never wider; the controls' row may shrink.
  assert.match(panel, /<div className="flex w-full max-w-full min-w-0 flex-col"/);
  assert.match(panel, /<div className="flex min-w-0 items-center gap-2 pt-1">/);
  // The sound bar cannot lengthen with the dictation: a width cap, no width of its own to offer, the newest bars only.
  assert.match(panel, /'flex h-\[22px\] min-w-0 max-w-\[160px\] grow basis-0 items-center justify-end gap-\[2\.5px\] overflow-hidden transition-opacity \[contain:inline-size\]/);
  assert.match(panel, /\{levels\.slice\(-SOUND_BARS\)\.map\(/);
  assert.match(panel, /export const SOUND_BARS = 28;/);
  assert.match(read(...BOXES['the chat page and case chat']), /maxHeight="min\(150px, 30dvh\)"/);
  assert.match(read(...BOXES['the homepage and the Space chat dock']), /maxHeight="min\(240px, 35dvh\)"/);
  assert.match(read(...BOXES['Space channels and task threads']), /max-h-\[min\(200px,35dvh\)\]/);
  assert.match(read(...BOXES['the agent panel']), /max-h-\[min\(10rem,30dvh\)\]/);
  // The typed box's height is written by its autosize, capped at maxHeight (prompt-input.tsx).
  assert.match(read('components', 'ui', 'prompt-input.tsx'), /el\.style\.height = `min\(\$\{el\.scrollHeight\}px, \$\{maxHeight\}\)`/);
});

test('Pause never opens the phone keyboard: the paused words take the focus only when tapped (Arthur, 26 November 2026)', () => {
  const panel = read('v2', 'features', 'dictation', 'DictationPanel.tsx');
  const paused = panel.slice(panel.indexOf('<textarea'), panel.indexOf('/>', panel.indexOf('<textarea')));
  assert.ok(paused.length > 0);
  // The attribute, not the comment that explains why it is gone.
  assert.doesNotMatch(paused, /^\s*autoFocus(=\{[^}]*\})?\s*$/m);
  assert.doesNotMatch(panel, /\.focus\(/);
});
