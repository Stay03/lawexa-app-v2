'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks } from '@/lib/utils/analytics';
import type {
  AdminQuizGranularity,
  AdminQuizSessionsPoint,
} from '@/types/admin-quiz';

const chartConfig = {
  count: { label: 'Sessions', color: 'var(--chart-1)' },
} satisfies ChartConfig;

interface AdminQuizSessionsChartProps {
  data: AdminQuizSessionsPoint[];
  granularity: AdminQuizGranularity;
}

/** Sessions started over the window. The x-axis adapts to the server granularity. */
export function AdminQuizSessionsChart({
  data,
  granularity,
}: AdminQuizSessionsChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        No data for this period
      </div>
    );
  }

  // Hourly points cross midnight in "last 24 hours": the midnight tick then names its day.
  const spansDays = granularity === 'hour' && bucketsSpanDays(data.map((point) => point.date));

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full sm:h-[260px]">
      <BarChart data={data} accessibilityLayer margin={{ left: 4, right: 16, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          ticks={hourlyTicks(data.map((point) => point.date), spansDays)}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={(v) => formatDateTick(String(v), granularity, spansDays)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={32}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_v, payload) => {
                const d = (payload?.[0]?.payload as AdminQuizSessionsPoint | undefined)?.date;
                return d == null ? '' : formatDateTooltipLabel(d, granularity);
              }}
            />
          }
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
