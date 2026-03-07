'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { formatNaira } from '@/lib/utils/currency';
import { formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';
import type { MrrTrendPoint } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const chartConfig = {
  mrr: {
    label: 'MRR',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

/******************************************************************************
                                 Types
******************************************************************************/

interface MrrTrendChartProps {
  data: MrrTrendPoint[];
  granularity: 'hour' | 'day';
}

/******************************************************************************
                                 Component
******************************************************************************/

export function MrrTrendChart({ data, granularity }: MrrTrendChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MRR Trend</CardTitle>
          <CardDescription>Monthly Recurring Revenue over time</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <TrendingUp className="h-8 w-8 opacity-40" />
          <p className="text-sm">No data for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>MRR Trend</CardTitle>
        <CardDescription>Monthly Recurring Revenue over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => formatDateTick(v, granularity)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => formatNaira(Number(v), { compact: true })}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => formatDateTooltipLabel(String(v), granularity)}
                  formatter={(value) => [formatNaira(Number(value), { decimals: 2 }), 'MRR']}
                />
              }
            />
            <defs>
              <linearGradient id="fillMrr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-mrr)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-mrr)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="mrr"
              type="monotone"
              fill="url(#fillMrr)"
              stroke="var(--color-mrr)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
