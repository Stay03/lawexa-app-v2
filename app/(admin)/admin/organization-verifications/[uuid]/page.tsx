'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react';

import {
  OpenCertificateButton,
  RejectOrganizationDialog,
} from '@/components/admin/organization-verifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { organizationsApi } from '@/lib/api/collab';
import { extractApiError } from '@/lib/utils/api-error';
import {
  adminOrganizationKey,
  useApproveOrganization,
} from '@/lib/hooks/useAdminOrganizationVerificationActions';

/**
 * One application, and the decision.
 *
 * ── WHAT IS HERE IS WHAT A PERSON NEEDS TO JUDGE ───────────────────────────
 * @arthur has to answer one question: is this company who it says it is. So the
 * screen puts the claim and the evidence side by side — the name and kind they
 * registered, the contact details they gave, the number they quoted, and the
 * certificate they attached — and then two buttons.
 *
 * Nothing else. A member roster and an activity history belong on the
 * organization's own screen; here they would be things to read past.
 *
 * ── THE CERTIFICATE OPENS, AND IT WAITED FOR A REASON ──────────────────────
 * This screen shipped without an open button. Every certificate ever uploaded
 * had been written to a folder our deploys delete, found on 17 August 2026, and
 * @backendclaude warned that the download route would CHANGE SHAPE when his fix
 * landed — streaming the file before, returning a signed link after. A button
 * built against the old shape would have worked for an hour and then broken
 * with nothing in this file changing.
 *
 * So it waited on him CONFIRMING the deploy — he uploaded a document, opened it
 * and compared the bytes — rather than on the commit landing. `pushed` and
 * `working` were different things all that afternoon.
 *
 * Documents from BEFORE the fix are still gone, including the only application
 * in the queue today. That is said by the button when it happens rather than by
 * a warning over every company, which would now be false for the ones that
 * work. See `OpenCertificateButton`.
 */
export default function OrganizationVerificationPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);

  const query = useQuery({
    queryKey: adminOrganizationKey(uuid),
    queryFn: () => organizationsApi.getByUuid(uuid),
  });
  const approve = useApproveOrganization(uuid);
  const org = query.data?.data;

  if (query.isPending) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  if (query.isError || !org) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-destructive">
          {query.isError
            ? extractApiError(query.error).message
            : 'That organization could not be read.'}
        </p>
      </div>
    );
  }

  const applied = org.verification_requested_at;
  const decided = org.is_verified
    ? 'approved'
    : org.verification_rejected_at
      ? 'rejected'
      : applied
        ? 'waiting'
        : 'never applied';

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {org.type_label}
            {org.active_members_count != null
              ? ` · ${org.active_members_count} member${org.active_members_count === 1 ? '' : 's'}`
              : ''}
          </p>
        </div>
        <StatusBadge state={decided} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What they registered</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Email" value={org.email} />
            <Row label="Phone" value={org.phone} />
            <Row label="Website" value={org.website} />
            <Row
              label="Address"
              value={
                [org.address, org.city, org.state, org.country]
                  .filter(Boolean)
                  .join(', ') || null
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What they sent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="BN or RC number" value={org.bn_number} mono />
            <Row
              label="Applied"
              value={applied ? new Date(applied).toLocaleString() : null}
            />
            {org.verification_rejection_reason ? (
              <Row
                label="Last refused because"
                value={org.verification_rejection_reason}
              />
            ) : null}

            <div className="space-y-1.5 pt-1">
              <div className="text-muted-foreground">Certificate</div>
              {org.cac_document ? (
                <div className="flex items-start gap-2 rounded-lg border p-3">
                  <FileText
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0">
                    <div className="break-words font-medium">
                      {org.cac_document.original_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {org.cac_document.mime_type} ·{' '}
                      {Math.round(org.cac_document.size / 1024)} KB
                    </div>
                    <div className="pt-2">
                      <OpenCertificateButton
                        fileId={org.cac_document.id}
                        fileName={org.cac_document.original_name}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Nothing attached.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* The blanket "you cannot open anything" notice is gone: the storage fix
          is live and verified, so new certificates open. What remains true is
          narrower and is said by the button itself when it happens — a document
          uploaded before the fix no longer exists. A warning that fires for
          every company would now be lying to the reviewer about the ones that
          work. */}
      {applied && !org.cac_document ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <div className="space-y-1">
            <p className="font-medium">They applied without a certificate</p>
            <p className="text-muted-foreground">
              There is nothing attached to this application, so there is nothing
              to check it against.
            </p>
          </div>
        </div>
      ) : null}

      {decided === 'waiting' ? (
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => approve.mutate()}
            disabled={approve.isPending}
          >
            {approve.isPending ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <BadgeCheck aria-hidden />
            )}
            {approve.isPending ? 'Approving' : 'Approve'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setRejectOpen(true)}
          >
            Refuse
          </Button>
          {approve.isError ? (
            <p role="alert" className="w-full text-sm text-destructive">
              {extractApiError(approve.error).message}
            </p>
          ) : null}
        </div>
      ) : null}

      <RejectOrganizationDialog
        uuid={uuid}
        name={org.name}
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onRejected={() => router.push('/admin/organization-verifications')}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/organization-verifications"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden className="h-4 w-4" />
      All applications
    </Link>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono tabular-nums' : undefined}>
        {value || <span className="text-muted-foreground">Not given</span>}
      </span>
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  if (state === 'approved') {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-green-300 bg-green-50 text-green-600 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden />
        Approved
      </Badge>
    );
  }
  if (state === 'rejected') {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-red-300 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
      >
        <XCircle className="h-3 w-3" aria-hidden />
        Refused
      </Badge>
    );
  }
  if (state === 'waiting') {
    return <Badge variant="outline">Waiting</Badge>;
  }
  return <Badge variant="outline">Never applied</Badge>;
}
