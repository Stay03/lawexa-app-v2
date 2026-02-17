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
        color: 'var(--chart-1)',
      },
      total_tokens: {
        label: 'Tokens',
        color: 'var(--chart-3)',
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
              domain={[0, (max: number) => {
                if (max <= 0) return 10;
                const power = Math.pow(10, Math.floor(Math.log10(max)));
                return Math.ceil((max * 1.2) / power) * power;
              }]}
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
            />
            <Area
              yAxisId="tokens"
              dataKey="total_tokens"
              type="monotone"
              fill="none"
              stroke="var(--color-total_tokens)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
