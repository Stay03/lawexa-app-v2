'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import {
  LawyerVerificationInfoCard,
  LawyerVerificationDocumentCard,
  LawyerVerificationApproveDialog,
  LawyerVerificationRejectDialog,
} from '@/components/admin/lawyer-verifications';

import { useAdminLawyerVerification } from '@/lib/hooks/useAdminLawyerVerifications';
import { useBreadcrumbStore } from '@/lib/stores/breadcrumbStore';

/******************************************************************************
                                Page Props
******************************************************************************/

interface LawyerVerificationDetailPageProps {
  params: Promise<{ id: string }>;
}

/******************************************************************************
                                Main Component
******************************************************************************/

export default function LawyerVerificationDetailPage({
  params,
}: LawyerVerificationDetailPageProps) {
  const { id: idParam } = use(params);
  const id = Number(idParam);
  const router = useRouter();

  const { data, isLoading, error } = useAdminLawyerVerification(id);
  const { setOverride, clearOverride } = useBreadcrumbStore();

  // Dialog states
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  // Set breadcrumb label to lawyer name
  useEffect(() => {
    if (data?.data?.user?.name) {
      setOverride(idParam, data.data.user.name);
    }
    return () => {
      clearOverride(idParam);
    };
  }, [data?.data?.user?.name, idParam, setOverride, clearOverride]);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-32 mb-3" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48 mt-2" />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <Skeleton className="h-[400px] lg:w-80 lg:shrink-0" />
          <Skeleton className="h-[300px] flex-1" />
        </div>
      </div>
    );
  }

  // Error / not found
  if (error || !data?.data) {
    return (
      <div className="space-y-6">
        <Link href="/admin/lawyer-verifications">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 text-muted-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Lawyer Verifications
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {error
                ? 'Failed to load lawyer verification. Please try again.'
                : 'Lawyer profile not found.'}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push('/admin/lawyer-verifications')}
            >
              Back to Verifications
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const item = data.data;
  const isPending =
    !item.is_verified &&
    !!item.verification_submitted_at &&
    !item.verifier;

  return (
    <div className="space-y-6">
      {/* Back navigation + header */}
      <div>
        <Link href="/admin/lawyer-verifications">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 text-muted-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Lawyer Verifications
          </Button>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {item.user.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {item.user.email}
            </p>
          </div>

          {/* Action buttons — only for pending submissions */}
          {isPending && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => setApproveOpen(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Info card */}
        <LawyerVerificationInfoCard
          item={item}
          className="lg:w-80 lg:shrink-0"
        />

        {/* Right: Documents */}
        <div className="flex-1 space-y-6 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Submitted Documents
                <span className="text-sm font-normal text-muted-foreground">
                  ({item.documents.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {item.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No documents uploaded
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {item.documents.map((doc) => (
                    <LawyerVerificationDocumentCard
                      key={doc.id}
                      document={doc}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <LawyerVerificationApproveDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        item={item}
      />
      <LawyerVerificationRejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        item={item}
      />
    </div>
  );
}
