'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatHourIndex } from '@/lib/utils/quiz-format';
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

  const isHourly = granularity === 'hour';

  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) =>
            isHourly
              ? formatHourIndex(v)
              : new Date(v).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
          }
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
                const d = (
                  payload?.[0]?.payload as AdminQuizSessionsPoint | undefined
                )?.date;
                if (d == null) return '';
                return isHourly
                  ? formatHourIndex(d)
                  : new Date(d).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    });
              }}
            />
          }
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
