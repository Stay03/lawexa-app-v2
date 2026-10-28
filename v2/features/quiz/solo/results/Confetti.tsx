'use client';

import { useEffect, useRef } from 'react';

import { burstConfetti, confettiDone, stepConfetti } from './confetti-model';

/**
 * Confetti — one burst over the whole screen from `origin` (viewport
 * pixels), drawn on a canvas that never takes a tap, gone when the last
 * piece leaves the bottom (`confettiDone`, at most 3.2s). The parent mounts
 * it for the burst and unmounts it to stop at once (Skip). Decoration only:
 * hidden from screen readers, and never mounted under reduced motion.
 */
export function Confetti({ origin, onDone }: { origin: { x: number; y: number }; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      onDoneRef.current();
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.scale(ratio, ratio);

    const pieces = burstConfetti(origin);
    const start = performance.now();
    let last = start;
    let frame = 0;

    const draw = (now: number) => {
      stepConfetti(pieces, now - last);
      last = now;
      context.clearRect(0, 0, width, height);
      for (const piece of pieces) {
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.fillStyle = piece.color;
        if (piece.round) {
          context.beginPath();
          context.arc(0, 0, piece.height / 1.5, 0, Math.PI * 2);
          context.fill();
        } else {
          // A strip that turns: its width shrinks and grows like paper flipping.
          context.fillRect(-piece.width / 2, -piece.height / 2, piece.width * Math.cos(piece.angle * 1.7), piece.height);
        }
        context.restore();
      }
      if (confettiDone(pieces, height, now - start)) {
        context.clearRect(0, 0, width, height);
        onDoneRef.current();
        return;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [origin]);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-50 size-full" />;
}
