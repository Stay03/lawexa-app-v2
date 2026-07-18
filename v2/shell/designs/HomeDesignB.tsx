'use client';

import { HomeComposer } from './HomeComposer';

/**
 * HomeDesignB — the alternate candidate (Wave-1 stub). Deliberately distinct
 * from A so the switch is visibly doing something: a top-anchored, left-aligned
 * greeting with a lead-in line above the composer, and no prompt row. Same lean
 * intent — Wave 2 replaces it wholesale. Carries `data-design="b"` and the
 * server-renderable `data-v2-marker="V2-HOME"` curl marker.
 */
export function HomeDesignB({ name }: { name?: string }) {
  return (
    <div
      data-v2-marker="V2-HOME"
      data-design="b"
      className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-4 py-10"
    >
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          Lawexa research
        </p>
        <h1 className="mt-2 font-comfortaa text-[28px] font-semibold leading-tight text-foreground md:text-[40px]">
          Where should we start
          {name ? (
            <>
              , <span className="text-primary">{name}</span>
            </>
          ) : null}
          ?
        </h1>
      </div>

      <HomeComposer />
    </div>
  );
}
