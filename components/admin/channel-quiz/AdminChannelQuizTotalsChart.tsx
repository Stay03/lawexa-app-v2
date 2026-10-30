'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { AdminChannelQuizTotalsDay } from '@/types/admin-channel-quizzes';

const chartConfig = {
  plays: { label: 'Plays', color: 'var(--chart-1)' },
  finished: { label: 'Finished', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const longDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Plays and finished plays per day, every day of the range (the server fills empty days with 0). */
export function AdminChannelQuizTotalsChart({ days }: { days: AdminChannelQuizTotalsDay[] }) {
  if (!days.some((day) => day.plays > 0)) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No plays in this range</div>;
  }

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full sm:h-[260px]">
      <BarChart data={days} accessibilityLayer margin={{ left: 4, right: 16, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={shortDay} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_v, payload) => {
                const day = (payload?.[0]?.payload as AdminChannelQuizTotalsDay | undefined)?.date;
                return day ? longDay(day) : '';
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="plays" fill="var(--color-plays)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="finished" fill="var(--color-finished)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
