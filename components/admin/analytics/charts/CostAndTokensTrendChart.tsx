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
import type { CostAndTokensTrendPoint } from '@/types/admin';

interface CostAndTokensTrendChartProps {
  data: CostAndTokensTrendPoint[];
}

export function CostAndTokensTrendChart({
  data,
}: CostAndTokensTrendChartProps) {
  const { showNGN, exchangeRate } = useCurrencyStore();

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
          <CardDescription>Daily cost and token usage</CardDescription>
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
        <CardDescription>Daily cost and token usage</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={chartData} accessibilityLayer margin={{ top: 20 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
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
                  labelFormatter={(v) => {
                    return new Date(v).toLocaleDateString('en-US', {
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
