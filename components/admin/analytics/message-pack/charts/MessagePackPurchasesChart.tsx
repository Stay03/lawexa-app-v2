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
import { ShoppingCart } from 'lucide-react';
import { formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';
import type { MessagePackPurchasesOverTimePoint } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const chartConfig = {
  count: {
    label: 'Purchases',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

/******************************************************************************
                                 Functions
******************************************************************************/

function formatHourTick(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/******************************************************************************
                                 Types
******************************************************************************/

interface MessagePackPurchasesChartProps {
  data: MessagePackPurchasesOverTimePoint[];
  granularity: 'hour' | 'day';
}

/******************************************************************************
                                 Component
******************************************************************************/

export function MessagePackPurchasesChart({
  data,
  granularity,
}: MessagePackPurchasesChartProps) {
  const dataKey = granularity === 'hour' ? 'hour' : 'date';

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Purchases Over Time</CardTitle>
          <CardDescription>{granularity === 'hour' ? 'Hourly' : 'Daily'} completed purchases</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <ShoppingCart className="h-8 w-8 opacity-40" />
          <p className="text-sm">No data for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchases Over Time</CardTitle>
        <CardDescription>{granularity === 'hour' ? 'Hourly' : 'Daily'} completed purchases</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={dataKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) =>
                granularity === 'hour' ? formatHourTick(String(v)) : formatDateTick(String(v), granularity)
              }
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
                  labelFormatter={(v) =>
                    granularity === 'hour' ? formatHourTick(String(v)) : formatDateTooltipLabel(String(v), granularity)
                  }
                  formatter={(value) => [Number(value).toLocaleString(), 'Purchases']}
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
