'use client';

import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrencyStore } from '@/lib/stores/currencyStore';

export function CurrencySettings() {
  const { exchangeRate, showNGN, setExchangeRate, setShowNGN } =
    useCurrencyStore();

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

      {/* Exchange Rate Settings */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 h-8 w-8">
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <PopoverHeader>
            <PopoverTitle>Exchange Rate</PopoverTitle>
          </PopoverHeader>

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
        </PopoverContent>
      </Popover>
    </div>
  );
}
