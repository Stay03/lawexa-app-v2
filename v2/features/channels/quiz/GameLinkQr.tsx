'use client';

import { useMemo, useState } from 'react';
import { Maximize2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RaisedButton } from '@/v2/features/quiz/solo/ui';
import '@/v2/features/quiz/solo/solo-quiz.css';
import { QR_QUIET_ZONE, qrMatrixPath } from './game-link-qr';

/**
 * GameLinkQr — the QR code of a game's link, for people in the room to scan
 * from the host's screen (Arthur's spec, 9 November 2026: "a link and QR code
 * that add people to the Space and take them straight into the game").
 *
 * Drawn on the device from the link the server gave (`game-link-qr.ts`); no
 * request leaves the page. The code is black on white in dark mode too: many
 * phone scanners do not read a light code on a dark ground.
 *
 * SHOW LARGE is for a projector or a TV in a lecture hall: the code fills the
 * screen with the link under it, so a room can scan it from the back rows or
 * type it in.
 */
export function GameLinkQr({ url }: { url: string }) {
  const [large, setLarge] = useState(false);

  return (
    <div className="v2-solo flex flex-col items-center gap-3">
      <QrCode url={url} className="size-48 rounded-2xl border-2 border-border" />
      <RaisedButton tone="quiet" className="h-10 rounded-xl px-4 text-sm" onClick={() => setLarge(true)}>
        <Maximize2 aria-hidden className="size-4" />
        Show large
      </RaisedButton>

      <Dialog open={large} onOpenChange={setLarge}>
        <DialogContent
          showCloseButton={false}
          className="flex h-dvh max-h-none w-screen max-w-none flex-col items-center justify-center gap-6 rounded-none bg-white p-6 text-neutral-950 ring-0 sm:max-w-none dark:bg-white"
        >
          {/* The page is white in both themes, so its close is drawn for a white page: the shared
              close's hover is a theme token, dark on this page in dark mode. */}
          <DialogClose
            aria-label="Close"
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 hover:text-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:outline-none"
          >
            <X aria-hidden className="size-5" />
          </DialogClose>
          <DialogHeader className="items-center text-center">
            <DialogTitle className="font-comfortaa text-2xl font-bold text-neutral-950 md:text-4xl">Scan to join the game</DialogTitle>
            <DialogDescription className="text-base text-neutral-600 md:text-lg">
              You join the Space and go straight into the game.
            </DialogDescription>
          </DialogHeader>
          <QrCode url={url} className="aspect-square w-[min(80vw,62dvh)]" />
          <p className="max-w-full font-mono text-sm break-all text-neutral-700 md:text-xl">{url}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QrCode({ url, className }: { url: string; className?: string }) {
  const { size, d } = useMemo(() => qrMatrixPath(url), [url]);
  const box = size + QR_QUIET_ZONE * 2;
  return (
    <svg
      role="img"
      aria-label="QR code for the game link"
      viewBox={`${-QR_QUIET_ZONE} ${-QR_QUIET_ZONE} ${box} ${box}`}
      shapeRendering="crispEdges"
      className={cn('block bg-white', className)}
    >
      <path d={d} fill="#000" />
    </svg>
  );
}
