'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
  AdminUserSinglePicker,
  type AdminUserSinglePickerValue,
} from '@/components/admin/AdminUserSinglePicker';
import {
  useAdminSponsors,
  useSponsorCampaigns,
} from '@/lib/hooks/useAdminSponsors';
import {
  MESSAGE_ROLES,
  MESSAGE_SENT_VIA_TIERS,
  type AdminMessageListParams,
  type MessageRole,
  type MessageSentVia,
} from '@/types/admin-messages';
import { ROLE_LABEL, SENT_VIA_LABEL } from './message-meta';

export type MessageFeedFilterState = Omit<
  AdminMessageListParams,
  'cursor' | 'per_page'
>;

interface MessageFeedFiltersProps {
  value: MessageFeedFilterState;
  onChange: (next: MessageFeedFilterState) => void;
  selectedUser: AdminUserSinglePickerValue | null;
  onSelectedUserChange: (next: AdminUserSinglePickerValue | null) => void;
}

const ROLE_OPTIONS: MessageRole[] = [...MESSAGE_ROLES];
const SENT_VIA_OPTIONS: MessageSentVia[] = [...MESSAGE_SENT_VIA_TIERS];

export function MessageFeedFilters({
  value,
  onChange,
  selectedUser,
  onSelectedUserChange,
}: MessageFeedFiltersProps) {
  const [searchInput, setSearchInput] = useState(value.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== (value.search ?? '')) {
      onChange({ ...value, search: debouncedSearch || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setSearchInput(value.search ?? '');
  }, [value.search]);

  const { data: sponsorsResp } = useAdminSponsors({ per_page: 100 });
  const sponsors = sponsorsResp?.data ?? [];

  const { data: campaignsResp } = useSponsorCampaigns(value.sponsor_id ?? 0);
  const campaigns = campaignsResp?.data ?? [];

  const selectedRoles = value.role ?? [];
  const selectedSentVia = value.sent_via ?? [];

  const patch = (partial: MessageFeedFilterState) => {
    onChange({ ...value, ...partial });
  };

  const toggleRole = (role: MessageRole) => {
    const next = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    patch({ role: next.length ? next : undefined });
  };

  const toggleSentVia = (tier: MessageSentVia) => {
    const next = selectedSentVia.includes(tier)
      ? selectedSentVia.filter((t) => t !== tier)
      : [...selectedSentVia, tier];
    patch({ sent_via: next.length ? next : undefined });
  };

  const handleUserChange = (next: AdminUserSinglePickerValue | null) => {
    onSelectedUserChange(next);
    patch({ user_id: next?.id, user_uuid: undefined });
  };

  const handleSponsorChange = (rawId: string) => {
    if (rawId === 'any') {
      patch({ sponsor_id: undefined, campaign_id: undefined });
    } else {
      const next = Number(rawId);
      patch({
        sponsor_id: next,
        // Reset campaign when sponsor changes — a stale campaign id under a
        // different sponsor would silently filter nothing.
        campaign_id: undefined,
      });
    }
  };

  const handleCampaignChange = (rawId: string) => {
    patch({ campaign_id: rawId === 'any' ? undefined : Number(rawId) });
  };

  const activeCount = [
    selectedRoles.length,
    selectedSentVia.length,
    value.search,
    value.user_id,
    value.conversation_uuid,
    value.sponsor_id,
    value.campaign_id,
    value.date_from,
    value.date_to,
    value.with_trashed ? 1 : 0,
  ].filter(Boolean).length;

  const clearAll = () => {
    onSelectedUserChange(null);
    onChange({});
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search message content…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-[260px]"
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Role
            {selectedRoles.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {selectedRoles.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[200px] p-2">
          <p className="px-2 pb-2 text-[11px] text-muted-foreground">
            Backend default is {ROLE_LABEL.user.toLowerCase()} only.
          </p>
          <ul className="space-y-1">
            {ROLE_OPTIONS.map((role) => (
              <li key={role}>
                <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 cursor-pointer">
                  <Checkbox
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <span className="text-sm">{ROLE_LABEL[role]}</span>
                </label>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Funding
            {selectedSentVia.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {selectedSentVia.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[240px] p-2">
          <ul className="space-y-1">
            {SENT_VIA_OPTIONS.map((tier) => (
              <li key={tier}>
                <label className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60 cursor-pointer">
                  <Checkbox
                    checked={selectedSentVia.includes(tier)}
                    onCheckedChange={() => toggleSentVia(tier)}
                  />
                  <span className="text-sm">{SENT_VIA_LABEL[tier]}</span>
                </label>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <AdminUserSinglePicker
        value={selectedUser}
        onChange={handleUserChange}
      />

      <Select
        value={value.sponsor_id ? String(value.sponsor_id) : 'any'}
        onValueChange={handleSponsorChange}
      >
        <SelectTrigger className="w-[170px]" size="sm">
          <SelectValue placeholder="Any sponsor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any sponsor</SelectItem>
          {sponsors.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.campaign_id ? String(value.campaign_id) : 'any'}
        onValueChange={handleCampaignChange}
        disabled={!value.sponsor_id}
      >
        <SelectTrigger className="w-[180px]" size="sm">
          <SelectValue
            placeholder={
              value.sponsor_id ? 'Any campaign' : 'Pick sponsor first'
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any campaign</SelectItem>
          {campaigns.map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={value.date_from ?? ''}
          onChange={(e) => patch({ date_from: e.target.value || undefined })}
          className="w-[145px]"
          aria-label="Date from"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <Input
          type="date"
          value={value.date_to ?? ''}
          onChange={(e) => patch({ date_to: e.target.value || undefined })}
          className="w-[145px]"
          aria-label="Date to"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            More
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[320px] space-y-3">
          <div className="space-y-1">
            <Label htmlFor="msg-conversation-uuid" className="text-xs">
              Conversation UUID
            </Label>
            <Input
              id="msg-conversation-uuid"
              placeholder="bffd397a-59f8-…"
              value={value.conversation_uuid ?? ''}
              onChange={(e) =>
                patch({ conversation_uuid: e.target.value || undefined })
              }
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Scope the feed to a single conversation.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div className="space-y-0.5">
              <p className="text-xs font-medium">Include deleted</p>
              <p className="text-[11px] text-muted-foreground">
                Show soft-deleted messages too.
              </p>
            </div>
            <Switch
              checked={!!value.with_trashed}
              onCheckedChange={(checked) =>
                patch({ with_trashed: checked || undefined })
              }
            />
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className={cn('gap-1')}
        >
          <X className="h-3.5 w-3.5" /> Clear all
        </Button>
      )}
    </div>
  );
}
