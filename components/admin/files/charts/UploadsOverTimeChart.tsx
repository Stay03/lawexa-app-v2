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
import type {
  FileUploadsOverTimePoint,
  FileAnalyticsGranularity,
} from '@/types/admin-files';
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';

interface UploadsOverTimeChartProps {
  data: FileUploadsOverTimePoint[];
  granularity: FileAnalyticsGranularity;
}

const chartConfig = {
  uploads: {
    label: 'Uploads',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

export function UploadsOverTimeChart({
  data,
  granularity,
}: UploadsOverTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Uploads Over Time</CardTitle>
          <CardDescription>File upload activity over the selected period</CardDescription>
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
        <CardTitle>Uploads Over Time</CardTitle>
        <CardDescription>File upload activity over the selected period</CardDescription>
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
            <defs>
              <linearGradient id="fillUploads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-uploads)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-uploads)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="uploads"
              type="monotone"
              fill="url(#fillUploads)"
              stroke="var(--color-uploads)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
