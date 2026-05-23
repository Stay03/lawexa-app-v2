'use client';

import { ChevronDown, Globe } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useUserCurrencyStore } from '@/lib/stores/userCurrencyStore';
import type { TCurrency } from '@/types/payment';

/******************************************************************************
                               Constants
******************************************************************************/

const CURRENCY_LABELS: Record<TCurrency, { code: string; name: string; symbol: string }> = {
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  USD: { code: 'USD', name: 'US Dollar', symbol: '$' },
};

const CURRENCY_ORDER: TCurrency[] = ['NGN', 'USD'];

/******************************************************************************
                               Types
******************************************************************************/

interface ICurrencyPickerProps {
  currency: TCurrency;
  /** True when geo detection is still resolving and no preference is stored yet. */
  isDetecting?: boolean;
  /** True when the active currency was chosen by the user, not auto-detected. */
  manualOverride?: boolean;
  className?: string;
}

/******************************************************************************
                               Components
******************************************************************************/

/**
 * Compact dropdown for the user to switch payment currency. Sits on `/pricing`
 * and in the PAYG purchase dialog. The active selection persists via
 * `useUserCurrencyStore` and survives reloads.
 */
function CurrencyPicker(props: ICurrencyPickerProps) {
  const { currency, isDetecting = false, manualOverride = false, className } = props;
  const setManual = useUserCurrencyStore((s) => s.setManual);

  const active = CURRENCY_LABELS[currency];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-9 gap-2 px-3 font-medium', className)}
          disabled={isDetecting}
          aria-label={`Change currency. Current: ${active.name}`}
        >
          <Globe className="size-3.5 text-muted-foreground" />
          <span className="tabular-nums">{active.symbol}</span>
          <span>{active.code}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Pay in
        </DropdownMenuLabel>

        <DropdownMenuRadioGroup
          value={currency}
          onValueChange={(value) => setManual(value as TCurrency)}
        >
          {CURRENCY_ORDER.map((code) => {
            const item = CURRENCY_LABELS[code];
            return (
              <DropdownMenuRadioItem key={code} value={code} className="gap-3 py-2.5">
                <span className="flex w-5 items-center justify-center text-base tabular-nums">
                  {item.symbol}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">{item.code}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{item.name}</span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>

        {!manualOverride && (
          <>
            <DropdownMenuSeparator />
            <p className="px-3 py-2 text-[11px] text-muted-foreground">
              Auto-detected from your location. Change anytime.
            </p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/******************************************************************************
                               Export default
******************************************************************************/

export default CurrencyPicker;
