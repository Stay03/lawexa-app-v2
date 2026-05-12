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

import { AdminUserSearchPicker } from '@/components/admin/sponsors/AdminUserSearchPicker';
import { useBulkGrant } from '@/lib/hooks/useAdminSponsors';
import { extractApiError } from '@/lib/utils/api-error';
import {
  BULK_GRANT_MAX_EMAILS,
  BULK_GRANT_MAX_USER_IDS,
  parseEmailsText,
} from '@/lib/validations/admin-sponsors';
import type {
  AdminBulkGrantPayload,
  AdminBulkGrantResult,
} from '@/types/admin-sponsors';
import type { IAdminUserListItem } from '@/types/admin';

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
  const [selectedUsers, setSelectedUsers] = useState<IAdminUserListItem[]>([]);

  const parsed = useMemo(() => parseEmailsText(text), [text]);
  const invalid = useMemo(
    () => parsed.filter((e) => !EMAIL_RE.test(e)),
    [parsed]
  );
  const validCount = parsed.length - invalid.length;
  const emailsOverLimit = parsed.length > BULK_GRANT_MAX_EMAILS;
  const userIdsOverLimit = selectedUsers.length > BULK_GRANT_MAX_USER_IDS;
  const totalToSubmit = validCount + selectedUsers.length;

  const canSubmit =
    !mutation.isPending &&
    totalToSubmit > 0 &&
    !emailsOverLimit &&
    !userIdsOverLimit &&
    invalid.length === 0;

  const handleSubmit = () => {
    if (!canSubmit) return;

    const payload: AdminBulkGrantPayload = {};
    if (validCount > 0) payload.emails = parsed;
    if (selectedUsers.length > 0) {
      payload.user_ids = selectedUsers.map((u) => u.id);
    }

    mutation.mutate(
      { campaignId, payload },
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
        <CardTitle>Choose recipients</CardTitle>
        <CardDescription>
          Search and add registered users, paste raw emails, or do both — the
          server dedupes by user.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">Search users</h3>
            <span
              className={cn(
                'text-xs tabular-nums',
                userIdsOverLimit
                  ? 'text-destructive font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {selectedUsers.length} selected / {BULK_GRANT_MAX_USER_IDS}
            </span>
          </div>
          <AdminUserSearchPicker
            selected={selectedUsers}
            onChange={setSelectedUsers}
            max={BULK_GRANT_MAX_USER_IDS}
            disabled={mutation.isPending}
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">Paste emails</h3>
            <span
              className={cn(
                'text-xs tabular-nums',
                emailsOverLimit
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
              <span className="ml-1 text-muted-foreground">
                / {BULK_GRANT_MAX_EMAILS}
              </span>
            </span>
          </div>
          <Textarea
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'alice@unilag.edu.ng\nbob@unilag.edu.ng\n...'}
            className="font-mono text-sm"
            disabled={mutation.isPending}
          />
          <p className="text-xs text-muted-foreground">
            One per line, comma-separated, or whitespace-separated. We dedupe
            and lowercase.
          </p>
        </section>

        {(emailsOverLimit || userIdsOverLimit) && (
          <p className="text-sm text-destructive">
            {emailsOverLimit &&
              `Trim emails to ${BULK_GRANT_MAX_EMAILS} or fewer. `}
            {userIdsOverLimit &&
              `Trim selected users to ${BULK_GRANT_MAX_USER_IDS} or fewer.`}
          </p>
        )}

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

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {totalToSubmit === 0
              ? 'Add at least one user or one email to enable submit.'
              : `${totalToSubmit} recipient${totalToSubmit === 1 ? '' : 's'} ready — server will dedupe overlaps.`}
          </p>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Grant {totalToSubmit > 0 ? totalToSubmit : ''} subscription
            {totalToSubmit === 1 ? '' : 's'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
