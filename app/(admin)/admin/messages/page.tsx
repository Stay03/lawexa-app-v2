'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { CurrencySettings } from '@/components/admin/CurrencySettings';
import { type AdminUserSinglePickerValue } from '@/components/admin/AdminUserSinglePicker';
import {
  MessageFeedFilters,
  type MessageFeedFilterState,
} from '@/components/admin/messages/MessageFeedFilters';
import { MessageFeedTable } from '@/components/admin/messages/MessageFeedTable';
import { MessageDetailSheet } from '@/components/admin/messages/MessageDetailSheet';
import { useAdminMessages } from '@/lib/hooks/useAdminMessages';
import {
  MESSAGE_ROLES,
  MESSAGE_SENT_VIA_TIERS,
  type AdminMessageRow,
  type MessageRole,
  type MessageSentVia,
} from '@/types/admin-messages';

const ROLE_SET = new Set<string>(MESSAGE_ROLES);
const SENT_VIA_SET = new Set<string>(MESSAGE_SENT_VIA_TIERS);

function parseFilters(search: URLSearchParams): MessageFeedFilterState {
  const roles = search
    .getAll('role')
    .filter((r): r is MessageRole => ROLE_SET.has(r));
  const sentVia = search
    .getAll('sent_via')
    .filter((s): s is MessageSentVia => SENT_VIA_SET.has(s));

  const userIdRaw = search.get('user_id');
  const sponsorIdRaw = search.get('sponsor_id');
  const campaignIdRaw = search.get('campaign_id');
  const withTrashedRaw = search.get('with_trashed');

  return {
    role: roles.length ? roles : undefined,
    sent_via: sentVia.length ? sentVia : undefined,
    user_id: userIdRaw ? Number(userIdRaw) : undefined,
    user_uuid: search.get('user_uuid') ?? undefined,
    conversation_uuid: search.get('conversation_uuid') ?? undefined,
    sponsor_id: sponsorIdRaw ? Number(sponsorIdRaw) : undefined,
    campaign_id: campaignIdRaw ? Number(campaignIdRaw) : undefined,
    date_from: search.get('date_from') ?? undefined,
    date_to: search.get('date_to') ?? undefined,
    search: search.get('search') ?? undefined,
    with_trashed:
      withTrashedRaw === 'true' || withTrashedRaw === '1' ? true : undefined,
  };
}

function toSearchParams(
  filters: MessageFeedFilterState,
  selectedId: number | null
): URLSearchParams {
  const p = new URLSearchParams();
  filters.role?.forEach((r) => p.append('role', r));
  filters.sent_via?.forEach((s) => p.append('sent_via', s));
  if (filters.user_id) p.set('user_id', String(filters.user_id));
  if (filters.user_uuid) p.set('user_uuid', filters.user_uuid);
  if (filters.conversation_uuid)
    p.set('conversation_uuid', filters.conversation_uuid);
  if (filters.sponsor_id) p.set('sponsor_id', String(filters.sponsor_id));
  if (filters.campaign_id) p.set('campaign_id', String(filters.campaign_id));
  if (filters.date_from) p.set('date_from', filters.date_from);
  if (filters.date_to) p.set('date_to', filters.date_to);
  if (filters.search) p.set('search', filters.search);
  if (filters.with_trashed) p.set('with_trashed', 'true');
  if (selectedId !== null) p.set('selected', String(selectedId));
  return p;
}

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const selectedId = useMemo(() => {
    const raw = searchParams.get('selected');
    return raw ? Number(raw) : null;
  }, [searchParams]);

  // Selected user is held in-memory so the picker can render a label without
  // re-fetching by id on hydration. URL persists only user_id (the wire field).
  const [selectedUser, setSelectedUser] =
    useState<AdminUserSinglePickerValue | null>(() =>
      filters.user_id
        ? {
            id: filters.user_id,
            name: `User #${filters.user_id}`,
            email: null,
          }
        : null
    );

  const updateUrl = useCallback(
    (nextFilters: MessageFeedFilterState, nextSelectedId: number | null) => {
      const qs = toSearchParams(nextFilters, nextSelectedId).toString();
      router.push(qs ? `/admin/messages?${qs}` : '/admin/messages');
    },
    [router]
  );

  const handleFiltersChange = useCallback(
    (next: MessageFeedFilterState) => {
      // Filter changes drop the selected row to avoid orphan refs that don't
      // match the new result set.
      updateUrl(next, null);
    },
    [updateUrl]
  );

  const handleRowClick = useCallback(
    (id: number) => {
      updateUrl(filters, id);
    },
    [filters, updateUrl]
  );

  const handleSheetOpenChange = useCallback(
    (open: boolean) => {
      if (!open) updateUrl(filters, null);
    },
    [filters, updateUrl]
  );

  const feed = useAdminMessages(filters);

  const selectedRow: AdminMessageRow | null = useMemo(() => {
    if (selectedId === null || !feed.data) return null;
    for (const page of feed.data.pages) {
      const hit = page.data.find((r) => r.id === selectedId);
      if (hit) return hit;
    }
    return null;
  }, [feed.data, selectedId]);

  // Usage only exists on assistant/tool rows. Hide the column unless the
  // active role filter would include any of them.
  const hasUsageColumn = useMemo(() => {
    const roles = filters.role;
    // Default backend role filter is `user` only → no usage.
    if (!roles) return false;
    return roles.some((r) => r === 'assistant' || r === 'tool');
  }, [filters.role]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Cross-user feed of every message with funding attribution and
            usage. Default view shows user prompts — toggle Role to include
            assistant responses with token cost.
          </p>
        </div>
        <CurrencySettings />
      </div>

      <MessageFeedFilters
        value={filters}
        onChange={handleFiltersChange}
        selectedUser={selectedUser}
        onSelectedUserChange={setSelectedUser}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Feed</CardTitle>
        </CardHeader>
        <CardContent>
          <MessageFeedTable
            pages={feed.data?.pages}
            isLoading={feed.isLoading}
            isFetchingNextPage={feed.isFetchingNextPage}
            hasNextPage={feed.hasNextPage}
            onLoadMore={() => feed.fetchNextPage()}
            onRowClick={handleRowClick}
            selectedId={selectedId}
            error={feed.error as Error | null}
            hasUsageColumn={hasUsageColumn}
          />
        </CardContent>
      </Card>

      <MessageDetailSheet
        open={selectedId !== null}
        onOpenChange={handleSheetOpenChange}
        row={selectedRow}
      />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-[260px]" />
          <Skeleton className="h-10 w-full max-w-[720px]" />
          <Skeleton className="h-[500px] rounded-2xl" />
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
