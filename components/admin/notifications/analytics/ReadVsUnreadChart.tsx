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
import type { ReadVsUnreadPoint } from '@/types/notification';
import { bucketGranularity, bucketsSpanDays, formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';

interface ReadVsUnreadChartProps {
  data: ReadVsUnreadPoint[];
}

const chartConfig = {
  read: {
    label: 'Read',
    color: 'var(--chart-3)',
  },
  unread: {
    label: 'Unread',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

export function ReadVsUnreadChart({ data }: ReadVsUnreadChartProps) {
  // The response names no granularity: an hour in the key means hourly, and an hourly range
  // across midnight names the midnight point's day.
  const granularity = bucketGranularity(data.map((point) => point.date));
  const spansDays = granularity === 'hour' && bucketsSpanDays(data.map((point) => point.date));
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Read vs Unread</CardTitle>
          <CardDescription>
            Daily read and unread notification counts
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
        <CardTitle>Read vs Unread</CardTitle>
        <CardDescription>
          Daily read and unread notification counts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
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
              dataKey="read"
              type="monotone"
              stroke="var(--color-read)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              dataKey="unread"
              type="monotone"
              stroke="var(--color-unread)"
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
