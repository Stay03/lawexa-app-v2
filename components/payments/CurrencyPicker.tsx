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
  /**
   * The currencies actually on sale, from the plans the server sent US.
   *
   * Not decoration. The server decides which plans a visitor may see, and
   * since the international plans are priced in naira there may be no dollar
   * plan on offer at all. Listing a currency with nothing behind it hands the
   * reader an empty pricing page — which is exactly what happened the night
   * the dollar plans were switched off.
   *
   * Omitted means show everything, for callers that have no plan list.
   */
  available?: TCurrency[];
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
  const { currency, available, isDetecting = false, manualOverride = false, className } = props;
  const setManual = useUserCurrencyStore((s) => s.setManual);

  const active = CURRENCY_LABELS[currency];

  /* Only currencies with something to buy. A caller that passes no list gets
     the full set, which is the old behaviour. A list that somehow excludes
     everything falls back to the full set too — an empty dropdown is worse
     than a wrong one. */
  const offered =
    available && available.length > 0
      ? CURRENCY_ORDER.filter((code) => available.includes(code))
      : CURRENCY_ORDER;
  const codes = offered.length > 0 ? offered : CURRENCY_ORDER;

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
          {codes.map((code) => {
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
