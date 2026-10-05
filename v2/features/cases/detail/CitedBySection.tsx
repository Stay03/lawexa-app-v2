'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger } from '@/components/ui/sheet';
import { useV2Session } from '@/v2/runtime/session-context';
import { quietPushUrlParams, quietReplaceUrlParams } from '@/v2/runtime/url-params';
import { FOCUS_RING } from '@/v2/shell/designs/modules';
import { CitedByPanel } from '../cited-by/CitedByPanel';
import {
  CITED_BY_PREVIEW_COUNT,
  citingCaseItem,
  needsFullList,
  panelOpenIn,
  panelParam,
  seeAllLabel,
} from '../cited-by/model';
import { casesQueries } from '../queries';
import { AuthorityList, type AuthorityItem } from './AuthorityList';

const LABEL = 'Cited by';
const SUB = 'Later judgments that cite this one.';

/**
 * CitedBySection — "Cited by" on the case page, sized by the REAL total.
 *
 * Two shapes, chosen by the total alone:
 *
 *   up to 10   every citing case is already in the case payload; those rows
 *              render as they are and nothing else is asked for.
 *   over 10    the ten most-cited citing cases, from their own short request,
 *              then "See all N", which opens the panel (`CitedByPanel`). The
 *              heading and the skeleton rows are up at once, because the total
 *              is known from the case payload before the rows arrive.
 *
 * A failed preview says so and offers a retry. It does not fall back to the
 * payload's rows: those are an unordered slice, and showing them under a
 * heading that promises the most-cited would hide the failure behind a wrong
 * list.
 *
 * BACK CLOSES THE PANEL (owner, 5 October 2026), the case chat's way
 * (`CaseScreen`, whose comment holds the autopsy): local state is the truth,
 * opening QUIET-pushes `?cited-by=all`, closing quiet-replaces it away, and a
 * popstate listener adopts the URL on Back and Forward. Quiet writes never wake
 * the router, so the rewritten `[slug]` refetch loop cannot start. The panel
 * opens closed on every load, so the server and the first client render agree.
 */
export function CitedBySection({
  id,
  slug,
  total,
  caseName,
  payloadItems,
}: {
  id: string;
  slug: string;
  total: number;
  /** The panel's subtitle: the case's name as the page's masthead prints it. */
  caseName: string;
  /** The case payload's own `cited_by` rows, already mapped. */
  payloadItems: AuthorityItem[];
}) {
  const { userId: viewerId } = useV2Session();
  const paged = needsFullList(total);
  const preview = useQuery({
    ...casesQueries.citedByPreview(slug, { viewerId }),
    enabled: paged,
  });

  const [open, setOpen] = useState(false);
  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (next) quietPushUrlParams(panelParam(true));
    else quietReplaceUrlParams(panelParam(false));
  }, []);
  useEffect(() => {
    const onPopState = () => setOpen(panelOpenIn(window.location.search));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (!paged) {
    return <AuthorityList id={id} label={LABEL} sub={SUB} items={payloadItems} />;
  }

  const items = preview.data?.data.map(citingCaseItem) ?? [];

  return (
    // The Sheet root draws nothing; it is controlled here (see the docblock),
    // and the trigger below still gets focus back when the panel closes.
    <Sheet open={open} onOpenChange={onOpenChange}>
      <AuthorityList
        id={id}
        label={LABEL}
        sub={SUB}
        items={items}
        total={total}
        more={
          <SheetTrigger asChild>
            <button
              type="button"
              className={cn(
                'v2-interactive group inline-flex min-h-9 items-center gap-1.5 self-start rounded-full px-2 text-xs font-medium text-primary transition-colors hover:text-foreground',
                FOCUS_RING,
              )}
            >
              {seeAllLabel(total)}
              <ArrowRight
                aria-hidden
                className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </button>
          </SheetTrigger>
        }
        loadingRows={preview.isPending ? CITED_BY_PREVIEW_COUNT : 0}
        notice={
          preview.isError ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-3 py-2.5 text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
            >
              <span>Couldn&rsquo;t load the citing cases.</span>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={preview.isFetching}
                onClick={() => void preview.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : null
        }
      />
      <CitedByPanel slug={slug} total={total} caseName={caseName} />
    </Sheet>
  );
}
