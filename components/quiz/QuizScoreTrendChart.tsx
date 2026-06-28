'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { formatSessionDate } from '@/lib/utils/quiz-format';
import type { QuizScoreTrendPoint } from '@/types/quiz';

const chartConfig = {
  score_percentage: { label: 'Score', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/** Smooth area chart of the student's recent session scores (0–100%). */
export function QuizScoreTrendChart({ data }: { data: QuizScoreTrendPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[240px] w-full">
      <AreaChart data={data} accessibilityLayer margin={{ left: -8, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fillQuizScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-score_percentage)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-score_percentage)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="completed_at"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v) =>
            new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
                const pt = payload?.[0]?.payload as QuizScoreTrendPoint | undefined;
                return pt ? formatSessionDate(pt.completed_at) : '';
              }}
              formatter={(value) => `${Math.round(Number(value))}%`}
            />
          }
        />
        <Area
          dataKey="score_percentage"
          type="monotone"
          stroke="var(--color-score_percentage)"
          strokeWidth={2}
          fill="url(#fillQuizScore)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
