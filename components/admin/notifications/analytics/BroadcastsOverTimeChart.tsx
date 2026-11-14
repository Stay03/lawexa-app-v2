'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
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
import type { BroadcastsOverTimePoint } from '@/types/notification';
import { bucketGranularity, bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks } from '@/lib/utils/analytics';

interface BroadcastsOverTimeChartProps {
  data: BroadcastsOverTimePoint[];
}

const chartConfig = {
  broadcasts: {
    label: 'Broadcasts',
    color: 'var(--chart-1)',
  },
  notifications_sent: {
    label: 'Notifications Sent',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export function BroadcastsOverTimeChart({
  data,
}: BroadcastsOverTimeChartProps) {
  // The response names no granularity: an hour in the key means hourly, and an hourly range
  // across midnight names the midnight point's day.
  const granularity = bucketGranularity(data.map((point) => point.date));
  const spansDays = granularity === 'hour' && bucketsSpanDays(data.map((point) => point.date));
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Broadcasts Over Time</CardTitle>
          <CardDescription>
            Daily broadcast count and notifications delivered
          </CardDescription>
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
        <CardTitle>Broadcasts Over Time</CardTitle>
        <CardDescription>
          Daily broadcast count and notifications delivered
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              ticks={hourlyTicks(data.map((point) => point.date), spansDays)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => formatDateTick(String(v), granularity, spansDays)}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => formatDateTooltipLabel(String(v), granularity)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="broadcasts"
              type="monotone"
              stroke="var(--color-broadcasts)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              dataKey="notifications_sent"
              type="monotone"
              stroke="var(--color-notifications_sent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
