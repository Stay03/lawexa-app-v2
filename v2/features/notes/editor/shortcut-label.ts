'use client';

import { useSyncExternalStore } from 'react';

/**
 * shortcut-label — a Tiptap key binding written the way the reader's keyboard
 * says it, for the toolbar's tooltips (Arthur's editor step 1, 19 October
 * 2026: "tooltips with shortcuts").
 *
 * The bindings are Tiptap's own (`Mod-b`, `Mod-Shift-8`, `Mod-Alt-2`, read from
 * the installed 3.15.3 extensions), so a tooltip can never promise a key the
 * editor does not answer. `Mod` is ⌘ on a Mac and Ctrl elsewhere; a Mac shows
 * the symbols run together (⌘⇧8), everything else spells them with "+"
 * (Ctrl+Shift+8), as each platform's own menus do.
 */

const MAC_SYMBOL: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' };
const OTHER_WORD: Record<string, string> = { Mod: 'Ctrl', Shift: 'Shift', Alt: 'Alt', Ctrl: 'Ctrl' };

/** "Mod-Shift-8" → "⌘⇧8" on a Mac, "Ctrl+Shift+8" elsewhere. */
export function shortcutLabel(keys: string, mac: boolean): string {
  // The last part is the key itself; a literal "-" key would arrive as an empty
  // part after the split, so it is put back.
  const parts = keys.split('-');
  const key = parts.pop() || '-';
  const named = key === '\\' ? '\\' : key.length === 1 ? key.toUpperCase() : key;
  if (mac) return parts.map((part) => MAC_SYMBOL[part] ?? part).join('') + named;
  return [...parts.map((part) => OTHER_WORD[part] ?? part), named].join('+');
}

/** Whether this device's keyboard is a Mac's, read from the browser. */
export function isMacPlatform(platform: string, userAgent: string): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(userAgent);
}

const noSubscribe = () => () => undefined;

/**
 * The platform, read once the page runs in a browser. The server's answer is
 * "not a Mac", so the first paint and hydration agree, and a Mac reader's
 * tooltips switch to ⌘ before anyone can hover one.
 */
export function useIsMac(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => isMacPlatform(navigator.platform ?? '', navigator.userAgent ?? ''),
    () => false,
  );
}
