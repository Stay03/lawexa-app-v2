'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import type { RevenueOverTimePoint } from '@/types/admin';

interface RevenueOverTimeChartProps {
  data: RevenueOverTimePoint[];
  granularity: 'hour' | 'day';
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'var(--chart-2)',
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

export function RevenueOverTimeChart({
  data,
  granularity,
}: RevenueOverTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
          <CardDescription>{granularity === 'hour' ? 'Hourly' : 'Daily'} paid invoice revenue</CardDescription>
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
        <CardTitle>Revenue Over Time</CardTitle>
        <CardDescription>{granularity === 'hour' ? 'Hourly' : 'Daily'} paid invoice revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data} accessibilityLayer>
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
                  formatter={(value) => [formatNaira(Number(value)), 'Revenue']}
                />
              }
            />
            <Bar
              dataKey="revenue"
              fill="var(--color-revenue)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
