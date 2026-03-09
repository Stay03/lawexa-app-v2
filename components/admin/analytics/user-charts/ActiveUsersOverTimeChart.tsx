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
import type { ActiveUsersOverTimePoint, ViewAnalyticsGranularity } from '@/types/admin';

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

function formatHour(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

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
  const dataKey = isHourly ? 'hour' : 'date';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Users</CardTitle>
        <CardDescription>Daily/hourly active users</CardDescription>
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
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
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
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillActiveRegistered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-registered)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-registered)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillActiveGuest" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-guest)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-guest)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="registered"
              type="monotone"
              fill="url(#fillActiveRegistered)"
              stroke="var(--color-registered)"
              strokeWidth={2}
              stackId="active"
            />
            <Area
              dataKey="guest"
              type="monotone"
              fill="url(#fillActiveGuest)"
              stroke="var(--color-guest)"
              strokeWidth={2}
              stackId="active"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
