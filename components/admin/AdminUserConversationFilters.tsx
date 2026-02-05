'use client';

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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type { AdminUserConversationsParams } from '@/types/admin';

interface AdminUserConversationFiltersProps {
  params: AdminUserConversationsParams;
  onParamsChange: (params: Partial<AdminUserConversationsParams>) => void;
}

export function AdminUserConversationFilters({
  params,
  onParamsChange,
}: AdminUserConversationFiltersProps) {
  const { exchangeRate, showNGN, setExchangeRate, setShowNGN } =
    useCurrencyStore();

  return (
    <div className="flex flex-col sm:flex-row gap-3">
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
                Show in NGN
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
                $1 = {exchangeRate.toLocaleString()}
              </p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
