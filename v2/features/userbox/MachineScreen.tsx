'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MousePointer2, RotateCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { cursorPosition, DISPLAY, scrollDelta, toBoxKey, toDisplayPoint } from './machine-model';
import { openMachineView, type LawexaAction, type MachineView, type ViewerEvent } from './view-socket';

/**
 * MachineScreen — the live view of Lawexa's machine (Userbox v1): its
 * display drawn on a canvas at the panel's width, the person's own mouse and
 * keys sent back in display pixels, and Lawexa's cursor drawn where its last
 * action landed, labelled "Lawexa".
 *
 * THE CANVAS KEEPS THE DISPLAY'S SHAPE (1280 by 800), so a touch maps to the
 * display by the canvas's box alone (`toDisplayPoint`). It takes focus on a
 * click, and while it has it the keys go to the machine; Tab and the shortcut
 * keys go there too, since the page's own would only move focus away.
 *
 * A VIEW THAT DROPS asks for a fresh address (`onLost`: the token may have
 * lapsed) and reconnects when it comes, up to five times in a row; then it
 * stops and offers Reconnect, so a machine that went to sleep does not spin.
 */

const RECONNECT_TRIES = 5;
const RECONNECT_MS = 1500;

export function MachineScreen({
  url,
  onLost,
  onMode,
}: {
  url: string;
  /** The view dropped: read a fresh address. */
  onLost: () => void;
  /** The view says who drives now. */
  onMode: (mode: 'lawexa' | 'user') => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef<MachineView | null>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'lost'>('connecting');
  const [hasPicture, setHasPicture] = useState(false);
  const [lawexa, setLawexa] = useState<LawexaAction | null>(null);
  const triesRef = useRef(0);
  const onLostRef = useRef(onLost);
  const onModeRef = useRef(onMode);
  useEffect(() => {
    onLostRef.current = onLost;
    onModeRef.current = onMode;
  });

  // One view per address: a fresh address (a new token) is a new connection.
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d') ?? null;
    let live = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const view = openMachineView(
      url,
      {
        onFrame: (frame) => {
          void createImageBitmap(frame)
            .then((picture) => {
              if (live && context) context.drawImage(picture, 0, 0, DISPLAY.width, DISPLAY.height);
              picture.close();
              if (live) setHasPicture(true);
            })
            .catch(() => {});
        },
        onLawexaAction: (action) => {
          if (action.x !== null && action.y !== null) setLawexa(action);
        },
        onMode: (mode) => onModeRef.current(mode),
        onStatus: (next) => {
          if (!live) return;
          if (next === 'open') {
            triesRef.current = 0;
            setStatus('open');
            return;
          }
          triesRef.current += 1;
          if (triesRef.current > RECONNECT_TRIES) {
            setStatus('lost');
            return;
          }
          setStatus('connecting');
          retry = setTimeout(() => onLostRef.current(), RECONNECT_MS);
        },
      },
      (address) => new WebSocket(address),
    );
    viewRef.current = view;
    return () => {
      live = false;
      if (retry) clearTimeout(retry);
      view.close();
      viewRef.current = null;
    };
  }, [url]);

  // The wheel needs a listener that can stop the page scrolling under it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      const at = toDisplayPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
      const dy = scrollDelta(event.deltaY, event.deltaMode);
      if (!at || dy === null) return;
      event.preventDefault();
      viewRef.current?.send({ type: 'scroll', ...at, dy });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // Moves go at most once a frame.
  const pendingMoveRef = useRef<ViewerEvent | null>(null);
  const frameRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const pointAt = (event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    return canvas ? toDisplayPoint(event.clientX, event.clientY, canvas.getBoundingClientRect()) : null;
  };
  const buttonOf = (button: number): 'left' | 'middle' | 'right' => (button === 2 ? 'right' : button === 1 ? 'middle' : 'left');
  const send = (event: ViewerEvent) => viewRef.current?.send(event);

  const reconnect = () => {
    triesRef.current = 0;
    setStatus('connecting');
    onLost();
  };

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <canvas
          ref={canvasRef}
          width={DISPLAY.width}
          height={DISPLAY.height}
          tabIndex={0}
          aria-label="Lawexa’s machine. Click to use it; while it has focus your keys go to it."
          className={cn('block aspect-[16/10] h-auto w-full cursor-default touch-none outline-none', FOCUS_RING)}
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            event.currentTarget.focus();
            const at = pointAt(event);
            if (!at) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            send({ type: 'down', ...at, button: buttonOf(event.button) });
          }}
          onPointerUp={(event) => {
            const at = pointAt(event);
            if (at) send({ type: 'up', ...at, button: buttonOf(event.button) });
          }}
          onPointerMove={(event) => {
            const at = pointAt(event);
            if (!at) return;
            pendingMoveRef.current = { type: 'move', ...at };
            if (frameRef.current !== null) return;
            frameRef.current = requestAnimationFrame(() => {
              frameRef.current = null;
              if (pendingMoveRef.current) send(pendingMoveRef.current);
              pendingMoveRef.current = null;
            });
          }}
          onKeyDown={(event) => {
            const key = toBoxKey(event);
            // Ctrl+V or Cmd+V pastes the person's own clipboard (onPaste), not the machine's.
            if (!key || (key.type === 'key' && key.key === 'ctrl+v')) return;
            event.preventDefault();
            send(key);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text/plain');
            if (!text) return;
            event.preventDefault();
            send({ type: 'type', text: text.slice(0, 5000) });
          }}
        />

        {/* Lawexa's cursor, where its last action landed. */}
        {lawexa && lawexa.x !== null && lawexa.y !== null ? (
          <div
            aria-hidden
            className="pointer-events-none absolute transition-[left,top] duration-300 ease-out motion-reduce:transition-none"
            style={cursorPosition(lawexa.x, lawexa.y)}
          >
            <MousePointer2 className="size-5 -translate-x-0.5 -translate-y-0.5 fill-primary text-primary-foreground drop-shadow" />
            <span className="ml-3 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground shadow-sm">
              Lawexa
            </span>
          </div>
        ) : null}

        {!hasPicture || status !== 'open' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/70 text-sm text-muted-foreground">
            {status === 'lost' ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p>The live view stopped.</p>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={reconnect}>
                  <RotateCw aria-hidden className="size-4" />
                  Reconnect
                </Button>
              </div>
            ) : (
              <span className="flex items-center gap-2" role="status">
                <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
                {status === 'open' ? 'Waiting for the screen' : 'Connecting to the machine'}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
