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
import type { ChurnOverTimePoint } from '@/types/admin';

interface ChurnOverTimeChartProps {
  data: ChurnOverTimePoint[];
  granularity: 'hour' | 'day';
}

const chartConfig = {
  count: {
    label: 'Churned',
    color: 'var(--chart-5)',
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

export function ChurnOverTimeChart({
  data,
  granularity,
}: ChurnOverTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Churn Over Time</CardTitle>
          <CardDescription>{granularity === 'hour' ? 'Hourly' : 'Daily'} cancellations and expirations</CardDescription>
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
        <CardTitle>Churn Over Time</CardTitle>
        <CardDescription>{granularity === 'hour' ? 'Hourly' : 'Daily'} cancellations and expirations</CardDescription>
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
            <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
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
                />
              }
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
