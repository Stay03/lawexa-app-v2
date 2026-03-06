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
import { formatNaira } from '@/lib/utils/currency';
import type { MrrTrendPoint } from '@/types/admin';

interface MrrTrendChartProps {
  data: MrrTrendPoint[];
  granularity: 'hour' | 'day';
}

const chartConfig = {
  mrr: {
    label: 'MRR',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

function formatDateTick(value: string, granularity: 'hour' | 'day'): string {
  if (granularity === 'hour' && value.includes(' ')) {
    const h = parseInt(value.split(' ')[1], 10);
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h < 12 ? `${h} AM` : `${h - 12} PM`;
  }
  const d = new Date(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function MrrTrendChart({ data, granularity }: MrrTrendChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MRR Trend</CardTitle>
          <CardDescription>Monthly Recurring Revenue over time</CardDescription>
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
                  labelFormatter={(v) => {
                    if (granularity === 'hour' && String(v).includes(' ')) {
                      return formatDateTick(String(v), granularity);
                    }
                    return new Date(String(v)).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  }}
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
