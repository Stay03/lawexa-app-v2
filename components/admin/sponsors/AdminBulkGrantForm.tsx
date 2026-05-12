'use client';

import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

import { useBulkGrant } from '@/lib/hooks/useAdminSponsors';
import { extractApiError } from '@/lib/utils/api-error';
import {
  BULK_GRANT_MAX_EMAILS,
  parseEmailsText,
} from '@/lib/validations/admin-sponsors';
import type { AdminBulkGrantResult } from '@/types/admin-sponsors';

interface AdminBulkGrantFormProps {
  campaignId: number;
  onResult: (result: AdminBulkGrantResult) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminBulkGrantForm({
  campaignId,
  onResult,
}: AdminBulkGrantFormProps) {
  const mutation = useBulkGrant();
  const [text, setText] = useState('');

  const parsed = useMemo(() => parseEmailsText(text), [text]);
  const invalid = useMemo(
    () => parsed.filter((e) => !EMAIL_RE.test(e)),
    [parsed]
  );
  const validCount = parsed.length - invalid.length;
  const overLimit = parsed.length > BULK_GRANT_MAX_EMAILS;

  const canSubmit =
    !mutation.isPending &&
    validCount > 0 &&
    !overLimit &&
    invalid.length === 0;

  const handleSubmit = () => {
    if (!canSubmit) return;

    mutation.mutate(
      { campaignId, payload: { emails: parsed } },
      {
        onSuccess: (response) => {
          toast.success(response.message || 'Bulk grant processed');
          onResult(response.data);
        },
        onError: (error) => {
          const apiError = extractApiError(error);
          toast.error(apiError.message);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paste student emails</CardTitle>
        <CardDescription>
          One per line, comma-separated, or whitespace-separated. We dedupe and
          lowercase. Max {BULK_GRANT_MAX_EMAILS} per request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'alice@unilag.edu.ng\nbob@unilag.edu.ng\n...'}
          className="font-mono text-sm"
        />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span
            className={cn(
              'tabular-nums',
              overLimit
                ? 'text-destructive font-medium'
                : 'text-muted-foreground'
            )}
          >
            {parsed.length} parsed · {validCount} valid
            {invalid.length > 0 && (
              <span className="ml-2 text-destructive">
                · {invalid.length} invalid
              </span>
            )}
            <span className="ml-2 text-muted-foreground">
              / {BULK_GRANT_MAX_EMAILS}
            </span>
          </span>

          {parsed.length === 0 && (
            <span className="text-muted-foreground">
              Paste at least one email to enable submit.
            </span>
          )}

          {overLimit && (
            <span className="text-destructive">
              Trim to {BULK_GRANT_MAX_EMAILS} or fewer before submitting.
            </span>
          )}
        </div>

        {invalid.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-medium text-destructive mb-1">
              Invalid emails ({invalid.length})
            </p>
            <p className="text-xs text-destructive/80 break-all">
              {invalid.slice(0, 10).join(', ')}
              {invalid.length > 10 && ` … and ${invalid.length - 10} more`}
            </p>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Grant {validCount > 0 ? validCount : ''} subscription
            {validCount === 1 ? '' : 's'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
