'use client';

import { useState } from 'react';
import { Paintbrush, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  BAR_COLOUR_TEST_KEY,
  readBarColourTest,
  writeBarColourTest,
} from '@/v2/bar-colour-test';

/** Obvious on sight and impossible to mistake for one of ours. The point of the
 *  test is that nobody has to squint to know the answer. */
const PRESETS = [
  { hex: '#00c853', name: 'Green' },
  { hex: '#d500f9', name: 'Purple' },
  { hex: '#ff6d00', name: 'Orange' },
] as const;

/**
 * Forces a colour onto the phone's status bar, by hand, to answer one question.
 *
 * ── WHAT IT IS FOR ────────────────────────────────────────────────────────
 * The bar stopped following the app's theme in the INSTALLED app, and two
 * different things could be painting it — the page, or the colour fixed when
 * the app was installed. Both currently hold the same near-black, so looking at
 * the bar cannot tell them apart.
 *
 * Set an unmistakable colour here and open the installed app.
 *   The bar changes  →  the app reads the page, and it can be fixed properly.
 *   The bar does not →  the app is locked to its install colour, and no change
 *                       to the page will ever move it.
 *
 * ── IT WRITES THE PAGE'S INSTRUCTION AND NOTHING ELSE ─────────────────────
 * Deliberately, and it is the reason the test works. The install colour stays
 * exactly where it is. Moving both would put us back where we started, unable
 * to say which one answered.
 */
export function BarColourTestControl() {
  // Lazy initializer, read once on mount — the same idiom as the rest of this
  // panel, and never a read during render or a setState in an effect.
  const [colour, setColour] = useState<string | null>(() => readBarColourTest());

  function apply(next: string | null) {
    writeBarColourTest(next);
    setColour(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Paintbrush aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <Label htmlFor={BAR_COLOUR_TEST_KEY} className="text-sm">
            Force the status bar colour
          </Label>
          <p className="text-xs text-muted-foreground">
            For testing. Pick a colour, then open the installed app and look at
            the strip above the clock. If it changes, the app is reading the
            page. If it stays as it was, the app is using the colour fixed when
            it was installed and nothing here can move it.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.hex}
            type="button"
            size="sm"
            variant={colour === p.hex ? 'default' : 'outline'}
            className="h-8"
            onClick={() => apply(p.hex)}
          >
            <span
              aria-hidden
              className="mr-2 inline-block h-3 w-3 rounded-full border border-black/20"
              style={{ backgroundColor: p.hex }}
            />
            {p.name}
          </Button>
        ))}

        {/* The native picker for anything the three presets do not cover. It
            emits `#rrggbb`, which is the only shape the store accepts. */}
        <input
          id={BAR_COLOUR_TEST_KEY}
          type="color"
          value={colour ?? '#0a0a0a'}
          onChange={(e) => apply(e.target.value)}
          className="h-8 w-12 cursor-pointer rounded-md border bg-transparent p-1"
          aria-label="Pick any status bar colour"
        />

        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8"
          onClick={() => apply(null)}
          disabled={colour === null}
        >
          <RotateCcw aria-hidden className="mr-1.5 h-3.5 w-3.5" />
          Back to normal
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {colour === null ? (
          <>Not forced. The bar follows the app&apos;s own light and dark.</>
        ) : (
          <>
            Forced to <span className="font-mono">{colour}</span> on this device
            only. Nobody else sees it, and it lasts until you press Back to
            normal.
          </>
        )}
      </p>
    </div>
  );
}
