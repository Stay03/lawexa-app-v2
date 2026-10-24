'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, FileQuestion, LogIn, RotateCw, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import type { ContentRequest } from '@/types/content-request';
import { useV2Session } from '@/v2/runtime/session-context';
import { SETTINGS_COLUMN } from '../SettingsList';
import { SettingsFormGroup } from '../SettingsForm';
import { SettingsState } from '../SettingsState';
import {
  contentHref,
  formatDay,
  openContentLabel,
  REQUESTS_PATH,
  requestHistory,
  statusSentence,
  typeWord,
} from './model';
import { requestsQueries } from './queries';
import { RequestStatusPill, RequestTypeTile } from './RequestStatus';
import { RequestFallback } from './states';

/**
 * RequestScreen — v2 `/content-requests/{uuid}`: one request. What was asked
 * and when, where it stands, what happened to it, the research team's reason
 * when it was turned down, and the content itself once it is fulfilled.
 *
 * The address is the one the "request received" and "request fulfilled" emails
 * link to. The bar carries no title here (`pushed-route.ts`): the request's own
 * title is the page's heading at every width.
 */
export function RequestScreen({ uuid }: { uuid: string }) {
  const { signedIn, userId: viewerId } = useV2Session();
  const query = useQuery({ ...requestsQueries.detail(uuid, viewerId), enabled: signedIn });

  if (!signedIn) {
    return (
      <div className={SETTINGS_COLUMN}>
        <SettingsState
          icon={LogIn}
          title="Sign in to see this request"
          description="Requests are kept with the account that made them."
          action={
            <Button asChild size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (query.isPending) return <RequestFallback />;

  if (query.isError) {
    const apiError = extractApiError(query.error);
    if (apiError.status === 404 || apiError.status === 403) {
      return (
        <div className={SETTINGS_COLUMN}>
          <SettingsState
            icon={FileQuestion}
            title="This request isn't here"
            description="It may have been removed, or it belongs to another account."
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={REQUESTS_PATH}>Your requests</Link>
              </Button>
            }
          />
        </div>
      );
    }
    return (
      <div className={SETTINGS_COLUMN}>
        <SettingsState
          icon={TriangleAlert}
          tone="alarm"
          title="This request did not load"
          description="Check your connection and try again."
          action={
            <Button
              size="sm"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RotateCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return <RequestBody request={query.data} />;
}

function RequestBody({ request }: { request: ContentRequest }) {
  const href = contentHref(request);
  const content = request.created_content ?? null;
  const sentence = statusSentence(request.status);
  const asked = formatDay(request.created_at);
  const history = requestHistory(request);

  return (
    <div className={cn(SETTINGS_COLUMN, 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200')}>
      <header className="px-1">
        <RequestStatusPill request={request} />
        <h1 className="mt-3 text-xl leading-snug font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] md:text-2xl">
          {request.title}
        </h1>
        <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
          {typeWord(request.type)}
          {asked ? ` · Asked ${asked}` : null}
        </p>
        {sentence ? <p className="mt-3 text-sm leading-relaxed text-foreground/90">{sentence}</p> : null}
      </header>

      <div className="mt-6 flex flex-col gap-5">
        {request.status === 'fulfilled' && content ? (
          <SettingsFormGroup id="request-content" label="What was added">
            <li className="flex min-h-14 items-center gap-3.5 px-4 py-2.5">
              <RequestTypeTile type={request.created_content_type ?? request.type} />
              <span className="min-w-0 flex-1 text-[15px] leading-snug font-medium text-foreground [overflow-wrap:anywhere]">
                {content.title}
              </span>
              {href ? (
                <Button asChild size="sm" className="shrink-0">
                  <Link href={href}>
                    {openContentLabel(request.created_content_type)}
                    <ArrowUpRight aria-hidden className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </li>
          </SettingsFormGroup>
        ) : null}

        {request.status === 'rejected' && request.rejection_reason ? (
          <section aria-labelledby="request-reason">
            <h2 id="request-reason" className="px-1 text-[13px] leading-snug font-medium text-muted-foreground">
              Why it was turned down
            </h2>
            <blockquote className="mt-2 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-foreground">
              {request.rejection_reason}
            </blockquote>
          </section>
        ) : null}

        {request.additional_notes ? (
          <SettingsFormGroup id="request-notes" label="Your notes">
            <li className="px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-foreground [overflow-wrap:anywhere]">
              {request.additional_notes}
            </li>
          </SettingsFormGroup>
        ) : null}

        <SettingsFormGroup id="request-history" label="History">
          {history.map((step) => (
            <li key={step.key} className="flex min-h-14 flex-col justify-center gap-0.5 px-4 py-2.5">
              <span className="text-[15px] leading-snug font-medium text-foreground">{step.label}</span>
              {step.day || step.by ? (
                <span className="text-[13px] leading-snug text-muted-foreground">
                  {[step.day, step.by ? `by ${step.by}` : null].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </li>
          ))}
        </SettingsFormGroup>
      </div>
    </div>
  );
}
