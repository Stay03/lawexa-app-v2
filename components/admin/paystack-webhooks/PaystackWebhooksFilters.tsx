'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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
import { ChevronDown, X } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { STATUS_TONE } from './webhook-meta';
import type {
  PaystackEventType,
  PaystackWebhookListParams,
  PaystackWebhookProcessingStatus,
} from '@/types/admin-paystack-webhooks';
import {
  PAYSTACK_HANDLED_EVENT_TYPES,
  PAYSTACK_UNHANDLED_EVENT_TYPES,
  PAYSTACK_WEBHOOK_PROCESSING_STATUSES,
} from '@/types/admin-paystack-webhooks';

export type WebhookFilterState = Omit<
  PaystackWebhookListParams,
  'cursor' | 'per_page'
>;

interface PaystackWebhooksFiltersProps {
  value: WebhookFilterState;
  onChange: (next: WebhookFilterState) => void;
}

export function PaystackWebhooksFilters({
  value,
  onChange,
}: PaystackWebhooksFiltersProps) {
  const [searchInput, setSearchInput] = useState(value.reference ?? '');
  const debouncedSearch = useDebounce(searchInput, 300);

  useEffect(() => {
    if (debouncedSearch !== (value.reference ?? '')) {
      onChange({ ...value, reference: debouncedSearch || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    setSearchInput(value.reference ?? '');
  }, [value.reference]);

  const selectedStatuses = value.processing_status ?? [];
  const selectedEvents = value.event_type ?? [];

  function patch(partial: WebhookFilterState) {
    onChange({ ...value, ...partial });
  }

  function toggleStatus(status: PaystackWebhookProcessingStatus) {
    const next = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    patch({ processing_status: next.length ? next : undefined });
  }

  function toggleEvent(event: PaystackEventType) {
    const next = selectedEvents.includes(event)
      ? selectedEvents.filter((e) => e !== event)
      : [...selectedEvents, event];
    patch({ event_type: next.length ? next : undefined });
  }

  const activeCount = [
    value.processing_status?.length,
    value.event_type?.length,
    value.signature_valid !== undefined,
    value.reference,
    value.event_id,
    value.user_id,
    value.date_from,
    value.date_to,
  ].filter(Boolean).length;

  const sigValue =
    value.signature_valid === undefined
      ? 'any'
      : value.signature_valid
        ? 'valid'
        : 'invalid';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        placeholder="Search payload (reference, email, …)"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-[260px]"
      />

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Status
            {selectedStatuses.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {selectedStatuses.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <div className="max-h-[320px] overflow-y-auto p-2 space-y-0.5">
            {PAYSTACK_WEBHOOK_PROCESSING_STATUSES.map((status) => (
              <label
                key={status}
                className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-1 hover:bg-accent"
              >
                <Checkbox
                  checked={selectedStatuses.includes(status)}
                  onCheckedChange={() => toggleStatus(status)}
                />
                <span>{STATUS_TONE[status].label}</span>
              </label>
            ))}
          </div>
          {selectedStatuses.length > 0 && (
            <div className="border-t p-2">
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() => patch({ processing_status: undefined })}
              >
                Clear status
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            Event type
            {selectedEvents.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {selectedEvents.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="max-h-[360px] overflow-y-auto p-3 space-y-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Handled
              </div>
              <div className="space-y-1">
                {PAYSTACK_HANDLED_EVENT_TYPES.map((evt) => (
                  <label
                    key={evt}
                    className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-accent font-mono text-xs"
                  >
                    <Checkbox
                      checked={selectedEvents.includes(evt)}
                      onCheckedChange={() => toggleEvent(evt)}
                    />
                    <span>{evt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                Unhandled (recorded only)
              </div>
              <div className="space-y-1">
                {PAYSTACK_UNHANDLED_EVENT_TYPES.map((evt) => (
                  <label
                    key={evt}
                    className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-accent font-mono text-xs"
                  >
                    <Checkbox
                      checked={selectedEvents.includes(evt)}
                      onCheckedChange={() => toggleEvent(evt)}
                    />
                    <span>{evt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          {selectedEvents.length > 0 && (
            <div className="border-t p-2">
              <Button
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() => patch({ event_type: undefined })}
              >
                Clear events
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      <Select
        value={sigValue}
        onValueChange={(v) =>
          patch({
            signature_valid:
              v === 'any' ? undefined : v === 'valid' ? true : false,
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any signature</SelectItem>
          <SelectItem value="valid">Valid only</SelectItem>
          <SelectItem value="invalid">Invalid only</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={value.date_from ?? ''}
          onChange={(e) => patch({ date_from: e.target.value || undefined })}
          className="w-[145px]"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <Input
          type="date"
          value={value.date_to ?? ''}
          onChange={(e) => patch({ date_to: e.target.value || undefined })}
          className="w-[145px]"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            More
            <ChevronDown className="h-4 w-4 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] space-y-3" align="end">
          <div className="space-y-1">
            <label className="text-xs font-medium">User ID</label>
            <Input
              type="number"
              placeholder="e.g. 2664"
              value={value.user_id ?? ''}
              onChange={(e) =>
                patch({
                  user_id: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Exact event id</label>
            <Input
              placeholder="evt_xxxxxxxxxxxxxxxx"
              value={value.event_id ?? ''}
              onChange={(e) =>
                patch({ event_id: e.target.value || undefined })
              }
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Exact match on Paystack&rsquo;s top-level event id. For fuzzy search
              (transaction reference, email, etc.) use the search box at the top.
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({})}
          className="gap-1"
        >
          <X className="h-3.5 w-3.5" /> Clear all
        </Button>
      )}
    </div>
  );
}
