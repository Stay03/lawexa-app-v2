'use client';

import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { ExchangeRateField } from '@/components/admin/ExchangeRateField';

export function AdminUserConversationFilters() {
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const setShowNGN = useCurrencyStore((s) => s.setShowNGN);

  return (
    <div className="flex justify-end">
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

            <ExchangeRateField id="conversation-filters-rate" />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
