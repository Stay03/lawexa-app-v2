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

function formatHour(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

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
  const dataKey = isHourly ? 'hour' : 'date';

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
              dataKey={dataKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                if (isHourly) return formatHour(v);
                const d = new Date(v);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
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
                  labelFormatter={(_v, payload) => {
                    const pt = payload?.[0]?.payload;
                    if (isHourly) return formatHour(String(pt?.hour ?? _v));
                    return new Date(pt?.date ?? _v).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  }}
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
