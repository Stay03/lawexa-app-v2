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
import { BarChart3 } from 'lucide-react';
import { formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';
import type { SubscriptionsOverTimePoint } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const chartConfig = {
  count: {
    label: 'New Subscriptions',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

/******************************************************************************
                                 Types
******************************************************************************/

interface SubscriptionsOverTimeChartProps {
  data: SubscriptionsOverTimePoint[];
  granularity: 'hour' | 'day';
}

/******************************************************************************
                                 Component
******************************************************************************/

export function SubscriptionsOverTimeChart({
  data,
  granularity,
}: SubscriptionsOverTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions Over Time</CardTitle>
          <CardDescription>{granularity === 'hour' ? 'Hourly' : 'Daily'} new subscription counts</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <BarChart3 className="h-8 w-8 opacity-40" />
          <p className="text-sm">No data for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscriptions Over Time</CardTitle>
        <CardDescription>{granularity === 'hour' ? 'Hourly' : 'Daily'} new subscription counts</CardDescription>
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
                  labelFormatter={(v) => formatDateTooltipLabel(String(v), granularity)}
                />
              }
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
