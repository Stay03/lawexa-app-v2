'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Search, X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type { AdminConversationsParams } from '@/types/admin';

interface AdminConversationFiltersProps {
  params: AdminConversationsParams;
  onParamsChange: (params: Partial<AdminConversationsParams>) => void;
}

export function AdminConversationFilters({
  params,
  onParamsChange,
}: AdminConversationFiltersProps) {
  const { exchangeRate, showNGN, setExchangeRate, setShowNGN } =
    useCurrencyStore();

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* User UUID Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by User UUID..."
          value={params.user_uuid || ''}
          onChange={(e) =>
            onParamsChange({ user_uuid: e.target.value || undefined, page: 1 })
          }
          className="pl-9 pr-9"
        />
        {params.user_uuid && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => onParamsChange({ user_uuid: undefined, page: 1 })}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status Filter */}
      <Select
        value={params.status || 'all'}
        onValueChange={(value) =>
          onParamsChange({
            status: value === 'all' ? undefined : (value as 'active' | 'archived'),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      {/* Privacy Filter */}
      <Select
        value={
          params.is_private === undefined
            ? 'all'
            : params.is_private
              ? 'private'
              : 'public'
        }
        onValueChange={(value) =>
          onParamsChange({
            is_private: value === 'all' ? undefined : value === 'private',
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Privacy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Privacy</SelectItem>
          <SelectItem value="private">Private</SelectItem>
          <SelectItem value="public">Public</SelectItem>
        </SelectContent>
      </Select>

      {/* Per Page Selector */}
      <Select
        value={String(params.per_page || 15)}
        onValueChange={(value) =>
          onParamsChange({ per_page: parseInt(value), page: 1 })
        }
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10 / page</SelectItem>
          <SelectItem value="15">15 / page</SelectItem>
          <SelectItem value="25">25 / page</SelectItem>
          <SelectItem value="50">50 / page</SelectItem>
        </SelectContent>
      </Select>

      {/* Currency Settings */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <Settings2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <PopoverHeader>
            <PopoverTitle>Currency Settings</PopoverTitle>
          </PopoverHeader>

          <div className="space-y-4">
            {/* Show NGN Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="show-ngn" className="text-sm">
                Show in NGN (₦)
              </Label>
              <Switch
                id="show-ngn"
                checked={showNGN}
                onCheckedChange={setShowNGN}
              />
            </div>

            {/* Exchange Rate Input */}
            <div className="space-y-2">
              <Label htmlFor="exchange-rate" className="text-sm">
                USD to NGN Rate
              </Label>
              <Input
                id="exchange-rate"
                type="number"
                min={1}
                step={1}
                value={exchangeRate}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  if (!isNaN(value) && value > 0) {
                    setExchangeRate(value);
                  }
                }}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                $1 = ₦{exchangeRate.toLocaleString()}
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
