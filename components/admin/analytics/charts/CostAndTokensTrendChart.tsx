'use client';

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import { useExchangeRate } from '@/lib/hooks/useExchangeRate';
import type { CostAndTokensTrendPoint } from '@/types/admin';

interface CostAndTokensTrendChartProps {
  data: CostAndTokensTrendPoint[];
  granularity: 'hour' | 'day';
}

function formatHourLabel(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function CostAndTokensTrendChart({
  data,
  granularity,
}: CostAndTokensTrendChartProps) {
  /* showNGN is this browser's preference; the RATE is the server setting,
     with a per-browser override on top. Different sources on purpose. */
  const showNGN = useCurrencyStore((s) => s.showNGN);
  const { rate: exchangeRate } = useExchangeRate();
  const isHourly = granularity === 'hour';
  const xKey = isHourly ? 'hour' : 'date';

  const chartConfig = useMemo<ChartConfig>(
    () => ({
      total_cost: {
        label: `Cost (${showNGN ? 'NGN' : 'USD'})`,
        color: 'oklch(0.75 0.15 55)',
      },
      total_tokens: {
        label: 'Tokens',
        color: 'oklch(0.72 0.15 180)',
      },
    }),
    [showNGN]
  );

  // Transform cost data when NGN is active
  const chartData = useMemo(() => {
    if (!showNGN) return data;
    return data.map((point) => ({
      ...point,
      total_cost: Number(point.total_cost) * exchangeRate,
    }));
  }, [data, showNGN, exchangeRate]);

  const costDomain = useMemo(() => {
    const max = Math.max(...chartData.map((d) => Number(d.total_cost)), 0);
    if (max <= 0) return { max: 10, ticks: [0, 2.5, 5, 7.5, 10] };
    const power = Math.pow(10, Math.floor(Math.log10(max)));
    const niceMax = Math.ceil((max * 1.2) / power) * power;
    const step = niceMax / 4;
    return {
      max: niceMax,
      ticks: [0, step, step * 2, step * 3, niceMax],
    };
  }, [chartData]);

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost & Tokens Trend</CardTitle>
          <CardDescription>{isHourly ? 'Hourly' : 'Daily'} cost and token usage</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost & Tokens Trend</CardTitle>
        <CardDescription>{isHourly ? 'Hourly' : 'Daily'} cost and token usage</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} accessibilityLayer margin={{ top: 20 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                if (isHourly) return formatHourLabel(v);
                const d = new Date(v);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis
              yAxisId="cost"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                const n = Number(v);
                if (showNGN) {
                  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
                  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
                  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}k`;
                  return `₦${n.toFixed(0)}`;
                }
                return `$${n.toFixed(2)}`;
              }}
              domain={[0, costDomain.max]}
              ticks={costDomain.ticks}
            />
            <YAxis
              yAxisId="tokens"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                const n = Number(v);
                if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
                if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
                return String(n);
              }}
              domain={[0, (max: number) => Math.ceil(max * 1.25)]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_v, payload) => {
                    const pt = payload?.[0]?.payload;
                    if (isHourly) return formatHourLabel(String(pt?.hour ?? _v));
                    return new Date(pt?.date ?? _v).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  }}
                  formatter={(value, name) => {
                    if (name === 'total_cost') {
                      if (showNGN) {
                        return [
                          `₦${Number(value).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                          'Cost',
                        ];
                      }
                      return [`$${Number(value).toFixed(4)}`, 'Cost'];
                    }
                    return [Number(value).toLocaleString(), 'Tokens'];
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-total_cost)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-total_cost)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              yAxisId="cost"
              dataKey="total_cost"
              type="monotone"
              fill="url(#fillCost)"
              stroke="var(--color-total_cost)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--color-total_cost)' }}
            />
            <Area
              yAxisId="tokens"
              dataKey="total_tokens"
              type="monotone"
              fill="none"
              stroke="var(--color-total_tokens)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: 'var(--color-total_tokens)' }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
