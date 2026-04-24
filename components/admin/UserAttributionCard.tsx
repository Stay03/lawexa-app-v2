'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, formatDistanceToNow } from 'date-fns';
import { ExternalLink, ArrowRight } from 'lucide-react';
import type { AdminUserAttributionDetail } from '@/types/admin';

interface UserAttributionCardProps {
  userUuid: string;
  attribution: AdminUserAttributionDetail | null;
}

export function UserAttributionCard({
  userUuid,
  attribution,
}: UserAttributionCardProps) {
  if (!attribution) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Attribution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No attribution data captured for this user.
          </p>
          <div className="mt-4">
            <ReferredByLink userUuid={userUuid} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Attribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {attribution.first_touched_at && (
            <Field label="First touched">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    {formatDistanceToNow(new Date(attribution.first_touched_at), {
                      addSuffix: true,
                    })}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">
                    {format(new Date(attribution.first_touched_at), 'PPpp')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </Field>
          )}

          {attribution.referrer_user && (
            <Field label="Referred by">
              <Link
                href={`/admin/users/${attribution.referrer_user.uuid}`}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                {attribution.referrer_user.name}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Field>
          )}

          {attribution.utm_source && (
            <Field label="UTM source">
              <span className="font-mono text-xs">{attribution.utm_source}</span>
            </Field>
          )}
          {attribution.utm_medium && (
            <Field label="UTM medium">
              <span className="font-mono text-xs">{attribution.utm_medium}</span>
            </Field>
          )}
          {attribution.utm_campaign && (
            <Field label="UTM campaign">
              <span className="font-mono text-xs">{attribution.utm_campaign}</span>
            </Field>
          )}
          {attribution.utm_term && (
            <Field label="UTM term">
              <span className="font-mono text-xs">{attribution.utm_term}</span>
            </Field>
          )}
          {attribution.utm_content && (
            <Field label="UTM content">
              <span className="font-mono text-xs">{attribution.utm_content}</span>
            </Field>
          )}
          {attribution.referral_code && (
            <Field label="Referral code">
              <span className="font-mono text-xs">{attribution.referral_code}</span>
            </Field>
          )}
        </div>

        {(attribution.referrer_url || attribution.landing_url) && (
          <div className="space-y-2 pt-3 border-t text-sm">
            {attribution.referrer_url && (
              <UrlField label="Referrer URL" url={attribution.referrer_url} />
            )}
            {attribution.landing_url && (
              <UrlField label="Landing URL" url={attribution.landing_url} />
            )}
          </div>
        )}

        <div className="pt-3 border-t">
          <ReferredByLink userUuid={userUuid} />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate">{children}</span>
    </div>
  );
}

function UrlField({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline inline-flex items-center gap-1 truncate font-mono text-xs"
      >
        <span className="truncate">{url}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </a>
    </div>
  );
}

function ReferredByLink({ userUuid }: { userUuid: string }) {
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-8 text-xs gap-1.5"
    >
      <Link href={`/admin/users?referred_by=${userUuid}`}>
        View users referred by this user
        <ArrowRight className="h-3 w-3" />
      </Link>
    </Button>
  );
}
