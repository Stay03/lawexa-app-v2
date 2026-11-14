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
import type { ActiveUsersOverTimePoint, ViewAnalyticsGranularity } from '@/types/admin';
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks } from '@/lib/utils/analytics';

interface ActiveUsersOverTimeChartProps {
  data: ActiveUsersOverTimePoint[];
  granularity: ViewAnalyticsGranularity;
}

const chartConfig = {
  registered: {
    label: 'Registered',
    color: 'var(--chart-1)',
  },
  guest: {
    label: 'Guest',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

export function ActiveUsersOverTimeChart({
  data,
  granularity,
}: ActiveUsersOverTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Users</CardTitle>
          <CardDescription>Daily/hourly active users</CardDescription>
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
        <CardTitle>Active Users</CardTitle>
        <CardDescription>Daily/hourly active users</CardDescription>
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
                  labelFormatter={(_v, payload) =>
                    formatDateTooltipLabel(String(payload?.[0]?.payload?.date ?? _v), granularity)
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="registered"
              type="monotone"
              stroke="var(--color-registered)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              dataKey="guest"
              type="monotone"
              stroke="var(--color-guest)"
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
