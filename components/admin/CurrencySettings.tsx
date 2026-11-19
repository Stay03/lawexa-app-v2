'use client';

import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { ExchangeRateNote } from '@/components/admin/ExchangeRateNote';

export function CurrencySettings() {
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const setShowNGN = useCurrencyStore((s) => s.setShowNGN);

  return (
    <div className="flex items-center gap-1.5">
      {/* Currency Toggle */}
      <div className="flex rounded-md border">
        <button
          onClick={() => setShowNGN(true)}
          className={cn(
            'px-2.5 py-1.5 text-xs font-medium transition-colors rounded-l-md',
            showNGN
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          NGN
        </button>
        <button
          onClick={() => setShowNGN(false)}
          className={cn(
            'px-2.5 py-1.5 text-xs font-medium transition-colors rounded-r-md border-l',
            !showNGN
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
        >
          USD
        </button>
      </div>

      {/* The rate in force, read only: one rate, set in Billing settings. */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 h-8 w-8">
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <PopoverHeader>
            <PopoverTitle>Exchange rate</PopoverTitle>
          </PopoverHeader>

          <ExchangeRateNote />
        </PopoverContent>
      </Popover>
    </div>
  );
}
