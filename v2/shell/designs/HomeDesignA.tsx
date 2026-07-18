'use client';

import { HomeComposer } from './HomeComposer';

/** Suggested prompts — Design A leads with them under the composer. */
const SUGGESTED_PROMPTS = [
  'Explain the ratio in Madukolu v Nkemdilim',
  'Consent under the Land Use Act, state by state',
  'Quiz me on the Evidence Act 2011',
] as const;

/**
 * HomeDesignA — the default candidate (Wave-1 stub). Centered greeting + shimmer
 * composer + a short prompt row. Real-but-minimal on purpose: Wave 2 replaces
 * this wholesale. Carries `data-design="a"` for the switch and the server-
 * renderable `data-v2-marker="V2-HOME"` the curl verification matrix greps for.
 *
 * Home greeting uses Comfortaa per the current owner decision (home surfaces =
 * Comfortaa; dense UI stays system sans).
 */
export function HomeDesignA({ name }: { name?: string }) {
  return (
    <div
      data-v2-marker="V2-HOME"
      data-design="a"
      className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-10"
    >
      <div className="mb-6 text-center">
        <h1 className="font-comfortaa text-[26px] font-semibold text-foreground md:text-[36px]">
          Good evening
          {name ? (
            <>
              , <span className="text-primary">{name}</span>
            </>
          ) : null}
          .
        </h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">
          What are we researching?
        </p>
      </div>

      <div className="w-full">
        <HomeComposer />

        <div className="mt-3 flex flex-col gap-2 md:flex-row md:flex-wrap md:justify-center">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="rounded-2xl border border-border px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary md:rounded-full md:py-2"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
