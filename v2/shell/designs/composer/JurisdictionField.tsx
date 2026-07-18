'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Globe, Layers, RotateCcw, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/authStore';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { jurisdictionsQueries } from '@/v2/features/jurisdictions/queries';
import type { Jurisdiction, JurisdictionChoice } from '@/types/jurisdiction';

/**
 * JurisdictionField — the composer's jurisdiction control. A v2-native rebuild of
 * v1's `JurisdictionStatus` + `JurisdictionPicker` (both boundary-blocked
 * `components/chat/*`), faithful to their UX, choice model, and copy that I
 * studied first-hand: a chip that opens a searchable popover over the REAL
 * jurisdiction list (`v2/features/jurisdictions`), with flags, an "Auto" default,
 * a "No specific jurisdiction (comparative)" option, and per-row selection state.
 *
 * The choice is CONTROLLED by the composer (which reads it into the create payload
 * and carries it into v1's per-conversation slot on send); `auto` resolves like v1 —
 * the signed-in user's profile country, falling back to Nigeria (the backend's
 * documented default).
 *
 * Flags come from `react-country-flag` (an existing dependency, SVG so they render
 * identically on every OS — unlike emoji flags on Windows), matching v1's renderer.
 *
 * PORTAL-EVENT DISCIPLINE (studied from v1): React synthetic events bubble through
 * the React tree even out of portaled popover content, so a click inside would
 * reach `PromptInput`'s root `onClick`, refocus the textarea, and Radix would read
 * that as focus-outside and close the popover. The content therefore stops click +
 * mousedown propagation.
 */

const DEFAULT_FALLBACK_SLUG = 'nigeria';

/** react-country-flag's OWN default CDN base (`node_modules/react-country-flag`:
 *  `https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/{code}.svg`). We warm
 *  these exact URLs in the background so the warmed request === the one the
 *  renderer makes → a guaranteed cache hit. Keep in sync if the renderer default
 *  ever changes (we never pass a custom `cdnUrl`, so it can't drift silently). */
const FLAG_CDN_URL = 'https://cdn.jsdelivr.net/gh/lipis/flag-icons/flags/4x3/';

/** The flag's reserved footprint (v1 parity: `1.1em`). The placeholder block and
 *  the SVG share this exact box so the slot never shifts as flags resolve. */
const FLAG_BOX = '1.1em';

/** Map a jurisdiction to a flag-renderable ISO 3166-1 alpha-2 code (v1's rule):
 *  most carry a 2-letter ISO code; UK subdivisions (ENG/SCT/NIR) fall back to the
 *  parent GB flag since the renderer has no subdivision art. */
function flagCode(j: Jurisdiction | undefined): string | undefined {
  if (!j) return undefined;
  if (j.code.length === 2) return j.code.toUpperCase();
  if (j.parent?.slug === 'united-kingdom') return 'GB';
  return undefined;
}

function Flag({ code, className }: { code: string | undefined; className?: string }) {
  if (!code) {
    return <Globe className={cn('size-4 text-muted-foreground', className)} aria-hidden />;
  }
  return <CountryFlag code={code} className={className} />;
}

/**
 * A single CDN flag that never flashes flagless (owner #31). react-country-flag
 * fetches each SVG from jsDelivr at render, so the slot reserves the EXACT flag
 * box up front (a subtle neutral placeholder holds it — skeleton-first, zero
 * layout shift) and the SVG fades in once loaded (~200ms, instant under reduced
 * motion). Background warming (see JurisdictionField) means most are cached by
 * the time the picker opens, so this usually reveals immediately.
 *
 * react-country-flag renders a bare <img> and spreads rest props onto it (verified
 * in its source), so `onLoad`/`onError`/`className`/`style` all reach the image —
 * but it does NOT forward a ref. To also catch flags ALREADY warm in cache (whose
 * `load` can fire before React wires `onLoad`), a wrapper ref checks the child
 * <img>'s `.complete` once on mount. `onError` still reveals a missing flag rather
 * than stranding the placeholder.
 */
function CountryFlag({ code, className }: { code: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);

  const revealIfCached = useCallback((node: HTMLSpanElement | null) => {
    if (!node) return;
    const img = node.querySelector('img');
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);

  return (
    <span
      ref={revealIfCached}
      aria-hidden
      className={cn('relative inline-block shrink-0 align-middle', className)}
      style={{ width: FLAG_BOX, height: FLAG_BOX }}
    >
      {/* Reserved-box placeholder — a quiet neutral block that holds the flag's
          footprint until the SVG resolves, then fades out as the flag fades in.
          Both directions transition; reduced motion snaps. */}
      <span
        className={cn(
          'absolute inset-0 rounded-[2px] bg-muted transition-opacity duration-200 ease-out motion-reduce:transition-none',
          loaded ? 'opacity-0' : 'opacity-100',
        )}
      />
      <ReactCountryFlag
        countryCode={code}
        svg
        loading="eager"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        // Fade + reduced-motion live on the className (so `motion-reduce` can
        // disable the transition); layout/geometry lives on `style` (overrides
        // the component's own 1em sizing to fill the reserved box).
        className={cn(
          'rounded-[2px] transition-opacity duration-200 ease-out motion-reduce:transition-none',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        aria-hidden
      />
    </span>
  );
}

interface JurisdictionFieldProps {
  /** Only fetch when the surface is signed in (the endpoint needs a token). */
  signedIn: boolean;
  /** Controlled choice — owned by the composer so submit can read it. */
  value: JurisdictionChoice;
  onChange: (next: JurisdictionChoice) => void;
  disabled?: boolean;
  /** Keep clicks inside portaled content from bubbling to PromptInput's root. */
  stop: (event: React.SyntheticEvent) => void;
}

export function JurisdictionField({
  signedIn,
  value: choice,
  onChange,
  disabled,
  stop,
}: JurisdictionFieldProps) {
  const [open, setOpen] = useState(false);

  const profileCountry = useAuthStore((s) => s.user?.profile?.country);
  const jurisdictionsQuery = useQuery({
    ...jurisdictionsQueries.list(),
    enabled: signedIn,
  });
  const jurisdictions = jurisdictionsQuery.data;
  const isLoading = jurisdictionsQuery.isPending && signedIn;

  // Warm every flag SVG in the background once the LIST resolves (owner #31), so
  // opening the picker doesn't fire a burst of first-time CDN fetches. Runs at
  // LOW priority (requestIdleCallback → setTimeout fallback) and is pure
  // fire-and-forget — no state, so it never competes with interactive work and
  // stays clear of the setState-in-effect lint. Warmed URLs match the renderer's
  // exactly (FLAG_CDN_URL), so the real render hits a warm cache.
  useEffect(() => {
    if (!jurisdictions || jurisdictions.length === 0 || typeof window === 'undefined') {
      return;
    }
    const urls = new Set<string>();
    for (const j of jurisdictions) {
      const code = flagCode(j);
      if (code) urls.add(`${FLAG_CDN_URL}${code.toLowerCase()}.svg`);
    }
    if (urls.size === 0) return;

    let idleHandle: number | undefined;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const warm = () => {
      for (const url of urls) {
        // Constructing an Image and setting src is enough to prime the HTTP
        // cache; the element is intentionally never attached to the DOM.
        const img = new Image();
        img.src = url;
      }
    };

    if ('requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(warm, { timeout: 2000 });
    } else {
      timeoutHandle = setTimeout(warm, 0);
    }

    return () => {
      if (idleHandle !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    };
  }, [jurisdictions]);

  // What "auto" effectively researches as: profile country → Nigeria fallback.
  const autoMatch = useMemo<Jurisdiction | undefined>(() => {
    if (!jurisdictions) return undefined;
    const needle = profileCountry?.trim().toLowerCase();
    const fromProfile = needle
      ? jurisdictions.find(
          (j) => j.name.toLowerCase() === needle || j.code.toLowerCase() === needle,
        )
      : undefined;
    return fromProfile ?? jurisdictions.find((j) => j.slug === DEFAULT_FALLBACK_SLUG);
  }, [jurisdictions, profileCountry]);

  const overrideMatch = useMemo<Jurisdiction | undefined>(() => {
    if (choice.mode !== 'override') return undefined;
    return jurisdictions?.find((j) => j.slug === choice.slug);
  }, [jurisdictions, choice]);

  const isOverridden = choice.mode !== 'auto';
  const label = describe({ choice, autoMatch, overrideMatch });

  const select = (next: JurisdictionChoice) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={stop}
          aria-label={`Jurisdiction: ${label.text}`}
          className={cn(
            'v2-interactive inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors',
            'text-muted-foreground hover:bg-secondary hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isOverridden
              ? 'border-primary/50 bg-primary/5 text-foreground'
              : 'border-border bg-transparent',
          )}
        >
          {isLoading ? (
            <Skeleton className="size-4 rounded-full" />
          ) : label.mode === 'none' ? (
            <Layers className="size-3.5 shrink-0" aria-hidden />
          ) : (
            <Flag code={label.code} className="shrink-0" />
          )}
          <span className="max-w-[7.5rem] truncate">{label.text}</span>
          <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[320px] p-2"
        onClick={stop}
        onMouseDown={stop}
      >
        <JurisdictionPicker
          jurisdictions={jurisdictions ?? []}
          choice={choice}
          autoMatch={autoMatch}
          isLoading={isLoading}
          isError={jurisdictionsQuery.isError}
          onRetry={() => jurisdictionsQuery.refetch()}
          onSelect={select}
        />
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */

function JurisdictionPicker({
  jurisdictions,
  choice,
  autoMatch,
  isLoading,
  isError,
  onRetry,
  onSelect,
}: {
  jurisdictions: Jurisdiction[];
  choice: JurisdictionChoice;
  autoMatch: Jurisdiction | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onSelect: (next: JurisdictionChoice) => void;
}) {
  const [search, setSearch] = useState('');

  const sorted = useMemo(
    () => [...jurisdictions].sort((a, b) => a.name.localeCompare(b.name)),
    [jurisdictions],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter(
      (j) =>
        j.name.toLowerCase().includes(needle) ||
        j.code.toLowerCase().includes(needle) ||
        (j.parent?.name.toLowerCase().includes(needle) ?? false),
    );
  }, [sorted, search]);

  const selectedSlug = choice.mode === 'override' ? choice.slug : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={isLoading || isError}
          aria-label="Search jurisdictions"
          placeholder={isLoading ? 'Loading…' : 'Search jurisdictions…'}
          className="w-full rounded-lg border bg-background py-1.5 pl-8 pr-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
          // Focus the search on open so keyboard users can type immediately
          // (matches v1's picker).
          autoFocus={!isLoading && !isError}
        />
      </div>

      {/* One listbox owns EVERY option row (Auto, the scrolling list, None) —
          options must be descendants of the listbox; the pinned/scrolling split
          below is purely presentational. */}
      <div role="listbox" aria-label="Jurisdictions" className="flex flex-col gap-1">
      {/* Auto (default) — resolves to the profile country, else Nigeria. */}
      <div className="border-b pb-1">
        <PickerRow
          selected={choice.mode === 'auto'}
          onClick={() => onSelect({ mode: 'auto' })}
          icon={<RotateCcw className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        >
          <span className="font-medium">Auto</span>
          {autoMatch ? (
            <span className="text-xs text-muted-foreground">— {autoMatch.name}</span>
          ) : null}
        </PickerRow>
      </div>

      <div className="max-h-64 overflow-y-auto overscroll-contain pt-1">
        {isLoading ? (
          <ul className="flex flex-col gap-1" aria-hidden>
            {[0.9, 0.75, 0.6, 0.45, 0.3, 0.2].map((opacity, index) => (
              <li
                key={index}
                className="flex items-center gap-2.5 px-2 py-1.5"
                style={{ opacity }}
              >
                <Skeleton className="size-4 shrink-0 rounded-sm" />
                <Skeleton className="h-3.5 w-32 rounded" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 px-2 py-6 text-center">
            <p className="text-xs text-muted-foreground">Couldn&apos;t load jurisdictions.</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            {filtered.map((j) => {
              const isSelected = selectedSlug === j.slug;
              return (
                <PickerRow
                  key={j.slug}
                  selected={isSelected}
                  onClick={() => onSelect({ mode: 'override', slug: j.slug })}
                  icon={<Flag code={flagCode(j)} className="shrink-0" />}
                >
                  <span className="truncate font-medium">{j.name}</span>
                  {j.parent ? (
                    <span className="truncate text-xs text-muted-foreground">
                      ({j.parent.name})
                    </span>
                  ) : null}
                </PickerRow>
              );
            })}
            {filtered.length === 0 ? (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                No jurisdictions match.
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* No specific jurisdiction (comparative). */}
      <div className="border-t pt-1">
        <PickerRow
          selected={choice.mode === 'none'}
          onClick={() => onSelect({ mode: 'none' })}
          icon={<Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        >
          <span>No specific jurisdiction (comparative)</span>
        </PickerRow>
      </div>
      </div>
    </div>
  );
}

function PickerRow({
  selected,
  onClick,
  icon,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        selected && 'bg-accent/60 text-accent-foreground',
      )}
    >
      {icon}
      {children}
      {selected ? <Check className="ml-auto size-4 shrink-0 text-primary" aria-hidden /> : null}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

function describe(args: {
  choice: JurisdictionChoice;
  autoMatch: Jurisdiction | undefined;
  overrideMatch: Jurisdiction | undefined;
}): { mode: JurisdictionChoice['mode']; text: string; code: string | undefined } {
  const { choice, autoMatch, overrideMatch } = args;
  if (choice.mode === 'none') {
    return { mode: 'none', text: 'No jurisdiction', code: undefined };
  }
  const j = choice.mode === 'override' ? overrideMatch : autoMatch;
  return {
    mode: choice.mode,
    text: j?.name ?? (choice.mode === 'override' ? choice.slug : 'Jurisdiction'),
    code: flagCode(j),
  };
}
