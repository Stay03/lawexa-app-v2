'use client';

import { ShoppingCart, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Note } from '@/types/note';
import { getNotePrices } from '@/lib/utils/note-utils';

interface NotePriceCardProps {
  note: Note;
  onPurchase?: () => void;
  animationDelay?: number;
  className?: string;
}

/**
 * Price card with purchase CTA for paid notes
 */
function NotePriceCard({
  note,
  onPurchase,
  animationDelay = 0,
  className,
}: NotePriceCardProps) {
  const prices = getNotePrices(note);

  // Don't show for free notes
  if (!prices || note.is_free) {
    return null;
  }

  return (
    <Card
      className={cn(
        'animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both border-primary/20 bg-primary/5 duration-300',
        className
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lock className="h-4 w-4 text-primary" />
          Premium Content
        </CardTitle>
        <CardDescription>
          This note requires purchase to view the full content.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Pricing */}
          <div className="space-y-1">
            {prices.ngn && (
              <p className="text-2xl font-bold text-foreground">{prices.ngn}</p>
            )}
            {prices.usd && (
              <p className="text-sm text-muted-foreground">
                or {prices.usd} USD
              </p>
            )}
          </div>

          {/* Purchase button */}
          <Button onClick={onPurchase} className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Purchase Note
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { NotePriceCard };
