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
import type { LawyerConnectRequestsOverTimePoint } from '@/types/admin-lawyer-connect';
import { bucketGranularity, bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks } from '@/lib/utils/analytics';

interface LawyerConnectRequestsChartProps {
  data: LawyerConnectRequestsOverTimePoint[];
}

const chartConfig = {
  count: {
    label: 'Requests',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function LawyerConnectRequestsChart({ data }: LawyerConnectRequestsChartProps) {
  // The response names no granularity: an hour in the key means hourly, and an hourly range
  // across midnight names the midnight point's day.
  const granularity = bucketGranularity(data.map((point) => point.date));
  const spansDays = granularity === 'hour' && bucketsSpanDays(data.map((point) => point.date));
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Requests Over Time</CardTitle>
          <CardDescription>Daily connection request submissions</CardDescription>
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
        <CardTitle>Requests Over Time</CardTitle>
        <CardDescription>Daily connection request submissions</CardDescription>
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
              allowDecimals={false}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => formatDateTooltipLabel(String(v), granularity)}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="count"
              type="monotone"
              fill="url(#fillRequests)"
              stroke="var(--color-count)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
