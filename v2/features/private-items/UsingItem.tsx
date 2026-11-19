'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ScrollText, X } from 'lucide-react';

import { myTemplatesApi, mySkillsApi } from '@/lib/api/private-items';
import type { UseItem } from '@/types/private-items';
import { parseUse, sharedAnswerLine, USE_PARAM } from './pages-model';

/**
 * The item "Use in chat" brought to this box (Arthur's pages, 19 November
 * 2026), read once from the address, which is then cleaned so a reload starts
 * a plain chat. `clear` takes it off (the chip's ×, or after the send).
 */
export function useUsingItem(): { item: UseItem | null; name: string | null; clear: () => void } {
  // Read once, on the client: nothing shows until the name has loaded, so the
  // first paint matches the server's.
  const [item, setItem] = useState<UseItem | null>(() =>
    typeof window === 'undefined' ? null : parseUse(new URLSearchParams(window.location.search).get(USE_PARAM)),
  );
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(USE_PARAM)) return;
    url.searchParams.delete(USE_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);
  const named = useQuery({
    queryKey: ['private-items', 'using', item?.kind, item?.uuid],
    queryFn: async () =>
      item?.kind === 'template' ? (await myTemplatesApi.get(item.uuid)).name : (await mySkillsApi.get(item!.uuid)).display_name,
    enabled: item !== null,
    staleTime: Infinity,
    meta: { silentError: true },
  });
  return { item: named.data ? item : null, name: named.data ?? null, clear: () => setItem(null) };
}

/** The chip at the top of the box: what this message will use, with × to take it off. */
export function UsingItemChip({
  item,
  name,
  inSpace,
  onClear,
}: {
  item: UseItem;
  name: string;
  inSpace: boolean;
  onClear: () => void;
}) {
  const Icon = item.kind === 'template' ? FileText : ScrollText;
  return (
    <div className="flex flex-col gap-1 px-2 pt-2">
      <span className="inline-flex max-w-full items-center gap-2 self-start rounded-lg bg-accent px-2.5 py-1.5 text-xs text-foreground">
        <Icon aria-hidden className="size-3.5 shrink-0 text-primary" />
        <span className="min-w-0 truncate">
          Using your {item.kind}: <span className="font-medium">{name}</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          aria-label={`Don't use ${name}`}
          className="v2-interactive -mr-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </span>
      {inSpace ? <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">{sharedAnswerLine(item.kind)}</p> : null}
    </div>
  );
}
