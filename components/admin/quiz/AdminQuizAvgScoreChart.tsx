'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatHourIndex } from '@/lib/utils/quiz-format';
import type {
  AdminQuizAvgScorePoint,
  AdminQuizGranularity,
} from '@/types/admin-quiz';

const chartConfig = {
  avg_score: { label: 'Avg score', color: 'var(--chart-2)' },
} satisfies ChartConfig;

interface AdminQuizAvgScoreChartProps {
  data: AdminQuizAvgScorePoint[];
  granularity: AdminQuizGranularity;
}

/** Average score over the window (0–100%). The x-axis adapts to granularity. */
export function AdminQuizAvgScoreChart({
  data,
  granularity,
}: AdminQuizAvgScoreChartProps) {
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
      <LineChart data={data} accessibilityLayer margin={{ left: -8, right: 8, top: 8 }}>
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
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={40}
          tickFormatter={(v) => `${v}%`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_v, payload) => {
                const d = (
                  payload?.[0]?.payload as AdminQuizAvgScorePoint | undefined
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
              formatter={(value) => `${Math.round(Number(value))}%`}
            />
          }
        />
        <Line
          dataKey="avg_score"
          type="monotone"
          stroke="var(--color-avg_score)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
