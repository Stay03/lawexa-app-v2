'use client';

import { Line, LineChart, YAxis } from 'recharts';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';

const chartConfig = {
  score: { label: 'Score', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/**
 * Compact, index-based sparkline of a user's session scores (oldest→newest).
 * Takes a plain `number[]` and maps it to points internally.
 */
export function UserScoreSparkline({ data }: { data: number[] }) {
  const points = data.map((score, index) => ({ index, score }));

  return (
    <ChartContainer config={chartConfig} className="h-[56px] w-full">
      <LineChart data={points} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
        <YAxis domain={[0, 100]} hide />
        <Line
          dataKey="score"
          type="monotone"
          stroke="var(--color-score)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
