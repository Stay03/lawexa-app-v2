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
import type { BroadcastsOverTimePoint } from '@/types/notification';

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
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                const d = new Date(v);
                return d.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                });
              }}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) =>
                    new Date(v).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient
                id="fillBroadcasts"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-broadcasts)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-broadcasts)"
                  stopOpacity={0.05}
                />
              </linearGradient>
              <linearGradient
                id="fillNotificationsSent"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor="var(--color-notifications_sent)"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-notifications_sent)"
                  stopOpacity={0.05}
                />
              </linearGradient>
            </defs>
            <Area
              dataKey="broadcasts"
              type="monotone"
              fill="url(#fillBroadcasts)"
              stroke="var(--color-broadcasts)"
              strokeWidth={2}
            />
            <Area
              dataKey="notifications_sent"
              type="monotone"
              fill="url(#fillNotificationsSent)"
              stroke="var(--color-notifications_sent)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
