'use client';

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
import { formatBytes } from '@/lib/utils/format-bytes';
import type {
  FileStorageOverTimePoint,
  FileAnalyticsGranularity,
} from '@/types/admin-files';
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks } from '@/lib/utils/analytics';

interface StorageOverTimeChartProps {
  data: FileStorageOverTimePoint[];
  granularity: FileAnalyticsGranularity;
}

const chartConfig = {
  cumulative_size: {
    label: 'Total Storage',
    color: 'var(--chart-2)',
  },
  added_size: {
    label: 'Added',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

export function StorageOverTimeChart({
  data,
  granularity,
}: StorageOverTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Over Time</CardTitle>
          <CardDescription>Cumulative storage usage over the selected period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const isHourly = granularity === 'hour';
  // Hourly points cross midnight in "last 24 hours": the midnight tick then names its day.
  const spansDays = isHourly && bucketsSpanDays(data.map((point) => point.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Over Time</CardTitle>
        <CardDescription>Cumulative storage usage over the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              ticks={hourlyTicks(data.map((point) => point.date), spansDays)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => formatDateTick(String(v), granularity, spansDays)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => formatBytes(v)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_v, payload) =>
                    formatDateTooltipLabel(String(payload?.[0]?.payload?.date ?? _v), granularity)
                  }
                  formatter={(value) => formatBytes(Number(value))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillCumulativeSize" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-cumulative_size)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-cumulative_size)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillAddedSize" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-added_size)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-added_size)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="cumulative_size"
              type="monotone"
              fill="url(#fillCumulativeSize)"
              stroke="var(--color-cumulative_size)"
              strokeWidth={2}
            />
            <Area
              dataKey="added_size"
              type="monotone"
              fill="url(#fillAddedSize)"
              stroke="var(--color-added_size)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
