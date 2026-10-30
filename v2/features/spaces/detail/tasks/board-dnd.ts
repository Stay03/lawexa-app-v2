'use client';

import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import type { PointerEvent as ReactPointerEvent } from 'react';

import type { SpaceTask } from '@/types/collab';
import { HOLD_TO_DRAG_MS, POINTER_DRAG_DISTANCE, dropId, stageBeside, stageOfDrop } from './task-drag-model';

/**
 * board-dnd — how a card is picked up on the task board (the drag plan
 * d589d99c and the task box design 1805492d):
 * - a mouse or pen after 8px of movement, so a click still opens the task;
 * - a finger after a 300ms hold, so a short touch still scrolls the board;
 * - the keyboard with Space only: Enter stays the key that opens the task,
 *   and Left or Right jump a whole column at a time.
 * Nothing inside `[data-no-dnd]` (the card's rename field, later) starts a drag.
 */

const fromNoDrag = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest('[data-no-dnd]') !== null;

/** A mouse or a pen. A finger is the touch sensor's, so a hold is needed. */
export class MouseOrPenSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent: event }: ReactPointerEvent) =>
        event.isPrimary && event.button === 0 && event.pointerType !== 'touch' && !fromNoDrag(event.target),
    },
  ];
}

export class HoldTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: ({ nativeEvent: event }: { nativeEvent: TouchEvent }) => event.touches.length === 1 && !fromNoDrag(event.target),
    },
  ];
}

/**
 * Left and Right (Up and Down on a phone) move the lifted card to the next
 * stage's drop target: a computer's column, or a phone's stage tab, whichever
 * is on screen. dnd-kit then finds it by the card's rectangle.
 */
export const taskKeyboardCoordinates: KeyboardCoordinateGetter = (event, { active, currentCoordinates, context }) => {
  const step = event.code === 'ArrowLeft' || event.code === 'ArrowUp' ? -1 : event.code === 'ArrowRight' || event.code === 'ArrowDown' ? 1 : 0;
  if (step === 0) return undefined;
  event.preventDefault();
  const task = (context.active?.data.current as { task?: SpaceTask } | undefined)?.task;
  const from = stageOfDrop(context.over?.id) ?? task?.stage;
  if (!from || !active) return currentCoordinates;
  const to = stageBeside(from, step);
  const rect = visible(context.droppableRects.get(dropId('column', to))) ?? visible(context.droppableRects.get(dropId('tab', to)));
  return rect ? { x: rect.left + 8, y: rect.top + 8 } : currentCoordinates;
};

function visible(rect: { left: number; top: number; width: number; height: number } | undefined) {
  return rect && rect.width > 0 && rect.height > 0 ? rect : undefined;
}

/** Under the pointer when there is one (a mouse, a finger); the card's rectangle for the keyboard. */
export const taskCollision: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : rectIntersection(args);
};

export function useTaskBoardSensors() {
  return useSensors(
    useSensor(MouseOrPenSensor, { activationConstraint: { distance: POINTER_DRAG_DISTANCE } }),
    useSensor(HoldTouchSensor, { activationConstraint: { delay: HOLD_TO_DRAG_MS, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: taskKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );
}
