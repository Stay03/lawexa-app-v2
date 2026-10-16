import type { KeyboardEvent } from 'react';

import { nextRadioIndex } from '../thread-status-model';

/**
 * Arrow keys in a radio group move FOCUS ONLY (checker, 16 October 2026):
 * ArrowUp/ArrowDown step and wrap, Home/End jump. Choosing sends a request
 * (or opens Needs Action's step), so it stays on click, Enter and Space. The
 * options are read off the group in the handler, never in render. Shared by
 * the status list on both surfaces and by the Needs Action member picker.
 */
export function moveRadioFocus(event: KeyboardEvent<HTMLElement>): void {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
  if (!keys.includes(event.key)) return;
  const radios = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
  );
  if (radios.length === 0) return;
  event.preventDefault();
  const at = radios.findIndex((radio) => radio === document.activeElement);
  const target = nextRadioIndex(event.key, at, radios.length);
  radios[target]?.focus();
}
