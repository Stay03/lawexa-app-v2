import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChatHostMemory, type MovableElement } from './chat-host-move';

/* Lucy, 25 October 2026: on the case page, a draft that opened while Lawexa
 * was still writing the answer (Open on its card, or the auto-open as it
 * finished) moved the chat from its floating frame to its docked one. Each
 * frame rendered its own conversation screen, so the move unmounted it and the
 * answer's stream went with it. Now the page renders the screen once and the
 * showing frame takes its node in (Stay chose this, option B). These tests hold
 * the move (scroll and focus put back) and the wiring on both pages. */

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

/** A minimal element: children by parent, a scroll offset, focus. */
class FakeElement implements MovableElement {
  parent: FakeElement | null = null;
  children: FakeElement[] = [];
  scrollTop = 0;
  scrollLeft = 0;
  focused = false;
  appendChild(child: MovableElement) {
    const node = child as FakeElement;
    if (node.parent) node.parent.children = node.parent.children.filter((c) => c !== node);
    // Leaving its old place resets every offset under it, as a browser does.
    node.walk((el) => { el.scrollTop = 0; el.scrollLeft = 0; el.focused = false; });
    node.parent = this;
    this.children.push(node);
    return node;
  }
  contains(other: MovableElement | null): boolean {
    for (let el = other as FakeElement | null; el; el = el.parent) if (el === this) return true;
    return false;
  }
  focus() { this.focused = true; }
  walk(fn: (el: FakeElement) => void) { fn(this); for (const c of this.children) c.walk(fn); }
}

function page() {
  const floating = new FakeElement();
  const docked = new FakeElement();
  const node = new FakeElement();
  const transcript = new FakeElement();
  const link = new FakeElement();
  node.appendChild(transcript);
  transcript.appendChild(link);
  const memory = createChatHostMemory(node);
  memory.attach(floating, () => true, false);
  return { floating, docked, node, transcript, link, memory };
}

test('the chat moves from the floating frame to the docked one as the same node, its scroll put back', () => {
  const { floating, docked, node, transcript, memory } = page();
  transcript.scrollTop = 840;
  memory.onScroll(transcript);
  // Open on a draft mid-answer, or the auto-open: the docked frame takes the node.
  memory.attach(docked, () => true, false);
  assert.equal(node.parent, docked, 'the same rendered screen, in the docked frame');
  assert.equal(floating.children.length, 0);
  assert.equal(transcript.scrollTop, 840, 'the transcript is where the reader left it');
  // And back when the editor closes and the chat floats again.
  memory.attach(floating, () => true, false);
  assert.equal(node.parent, floating);
  assert.equal(transcript.scrollTop, 840);
});

test('focus inside the chat comes back after the move; focus the reader moved elsewhere is left alone', () => {
  const { docked, floating, link, memory } = page();
  const outside = new FakeElement();
  memory.onFocusIn(link);
  memory.onFocusOut(null); // the node leaving the page takes focus nowhere
  memory.attach(docked, () => true, false);
  assert.equal(link.focused, true);

  memory.onFocusOut(outside); // the reader tabbed out of the chat
  memory.attach(floating, () => true, false);
  assert.equal(link.focused, false);
});

test('focus is not taken back from an element that has it since the move', () => {
  const { docked, link, memory } = page();
  memory.onFocusIn(link);
  memory.attach(docked, () => false, false);
  assert.equal(link.focused, false);
});

test('a frame that already holds the node leaves it be', () => {
  const { floating, node, transcript, memory } = page();
  transcript.scrollTop = 120;
  memory.onScroll(transcript);
  memory.attach(floating, () => true, true);
  assert.equal(node.parent, floating);
  assert.equal(transcript.scrollTop, 120);
});

test('both frames show the page’s one middle: neither renders the conversation screen itself', () => {
  const floating = read('v2', 'features', 'cases', 'detail', 'CaseAsk.tsx');
  const docked = read('v2', 'features', 'cases', 'detail', 'CaseChatPanel.tsx');
  for (const frame of [floating, docked]) {
    assert.doesNotMatch(frame, /<CaseChatMiddle\b(?!Slot)/);
    assert.match(frame, /const stageRef = useCaseChatStage\(\) \?\? ownStage;/);
  }
  // The floating panel and the phone's full screen both use the slot.
  assert.equal(floating.match(/<CaseChatMiddleSlot\b/g)?.length, 2);
  assert.equal(docked.match(/<CaseChatMiddleSlot\b/g)?.length, 1);
});

test('the case page and the statute reader render the middle once, inside their providers', () => {
  const host = read('v2', 'features', 'cases', 'detail', 'case-chat-host.tsx');
  // The portal comes after the frames, so the showing slot takes the node first.
  assert.match(host, /\{children\}\s*\{\/\*[\s\S]*?\*\/\}\s*\{host && view !== null\s*\? createPortal\(\s*<CaseChatMiddle view=\{view\}/);
  const caseScreen = read('v2', 'features', 'cases', 'detail', 'CaseScreen.tsx');
  assert.match(caseScreen, /<SidePanelHostProvider value=\{draftHost\}>[\s\S]*?<CaseChatHost\s+view=\{signedIn \? renderedChat : null\}[\s\S]*?onOpenChat=\{switchChatAway\}\s+onClose=\{closeChat\}\s*>/);
  assert.match(caseScreen, /<\/CaseChatHost>\s*<\/SidePanelHostProvider>/);
  const statute = read('v2', 'features', 'statutes', 'reader', 'StatuteScreen.tsx');
  assert.match(statute, /<DocumentLinkContext\.Provider value=\{linkHost\}>[\s\S]*?<CaseChatHost\s+view=\{hasAccount \? renderedChat : null\}[\s\S]*?onOpenChat=\{switchChat\}\s+onClose=\{closeChat\}\s*>/);
  assert.match(statute, /<\/CaseChatHost>\s*<\/DocumentLinkContext\.Provider>/);
});

test('the phone keeps one frame: its draft sheet opens over the page, the chat stays where it is', () => {
  // Below xl the draft is the main chat's sheet on document.body, and the chat
  // stays in CaseAskDock's full screen (the slot), so nothing moves on a phone.
  const caseScreen = read('v2', 'features', 'cases', 'detail', 'CaseScreen.tsx');
  assert.match(caseScreen, /element: desktop \? draftBox : phone \? document\.body : null/);
  const floating = read('v2', 'features', 'cases', 'detail', 'CaseAsk.tsx');
  assert.match(floating, /\{screenMounted \? \([\s\S]*?<CaseChatMiddleSlot/);
});
