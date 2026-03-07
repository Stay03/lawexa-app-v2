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
import { UserMinus } from 'lucide-react';
import { formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';
import type { ChurnOverTimePoint } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const chartConfig = {
  count: {
    label: 'Churned',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

/******************************************************************************
                                 Types
******************************************************************************/

interface ChurnOverTimeChartProps {
  data: ChurnOverTimePoint[];
  granularity: 'hour' | 'day';
}

/******************************************************************************
                                 Component
******************************************************************************/

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
        <CardContent className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <UserMinus className="h-8 w-8 opacity-40" />
          <p className="text-sm">No data for this period</p>
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
