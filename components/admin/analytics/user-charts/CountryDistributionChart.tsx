'use client';

import ReactCountryFlag from 'react-country-flag';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { CountryDistributionPoint } from '@/types/admin';
import { getCountryCode } from '@/lib/constants/country-codes';

interface CountryDistributionChartProps {
  data: CountryDistributionPoint[];
}

const BAR_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#f97316',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#eab308',
];

export function CountryDistributionChart({
  data,
}: CountryDistributionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Country</CardTitle>
          <CardDescription>Geographic distribution</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Country</CardTitle>
        <CardDescription>Geographic distribution</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-track]:bg-transparent">
        <div className="space-y-4">
          {data.map((item, index) => {
            const countryCode = getCountryCode(item.country);
            const barColor = BAR_COLORS[index % BAR_COLORS.length];
            const barWidthPercent =
              maxCount > 0 ? (item.count / maxCount) * 100 : 0;

            return (
              <div key={item.country} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {countryCode ? (
                      <ReactCountryFlag
                        countryCode={countryCode}
                        svg
                        style={{
                          width: '1.25em',
                          height: '1.25em',
                          borderRadius: '2px',
                        }}
                        aria-label={item.country}
                      />
                    ) : (
                      <span className="flex h-[1.25em] w-[1.25em] shrink-0 items-center justify-center rounded-sm bg-muted text-[10px] text-muted-foreground">
                        {item.country.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.country}
                    </span>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap shrink-0">
                    {item.count.toLocaleString()}
                    <span className="mx-1.5 text-muted-foreground/50">
                      &middot;
                    </span>
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidthPercent}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </CardContent>
    </Card>
  );
}
