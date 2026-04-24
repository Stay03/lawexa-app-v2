'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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
import { Skeleton } from '@/components/ui/skeleton';
import { getActionMeta } from './action-meta';
import type { ActivityStatsRow } from '@/types/admin-activity';

interface ActivityStatsChartProps {
  data: ActivityStatsRow[] | undefined;
  isLoading: boolean;
  topN?: number;
}

const PALETTE = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-1)',
  'var(--chart-2)',
];

export function ActivityStatsChart({
  data,
  isLoading,
  topN = 6,
}: ActivityStatsChartProps) {
  const { chartData, chartConfig, series } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], chartConfig: {} as ChartConfig, series: [] as string[] };
    }

    // Aggregate totals per action to pick top-N.
    const totals = new Map<string, number>();
    for (const row of data) {
      totals.set(row.action, (totals.get(row.action) ?? 0) + row.total);
    }
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, topN).map(([action]) => action);
    const topSet = new Set(top);

    // Build row-per-day, column-per-action.
    const byDay = new Map<string, Record<string, number | string>>();
    for (const row of data) {
      const day = row.day;
      if (!byDay.has(day)) byDay.set(day, { day });
      const bucket = byDay.get(day)!;
      const key = topSet.has(row.action) ? row.action : 'other';
      bucket[key] = ((bucket[key] as number) ?? 0) + row.total;
    }

    const chartData = [...byDay.values()].sort((a, b) =>
      String(a.day).localeCompare(String(b.day))
    );

    const series = [...top];
    const hasOther = sorted.length > topN;
    if (hasOther) series.push('other');

    const config: ChartConfig = {};
    series.forEach((action, i) => {
      const meta = getActionMeta(action);
      config[action] = {
        label: action === 'other' ? 'Other' : meta.label || action,
        color: PALETTE[i % PALETTE.length],
      };
    });

    return { chartData, chartConfig: config, series };
  }, [data, topN]);

  if (isLoading) {
    return <Skeleton className="h-[320px] rounded-2xl" />;
  }

  const empty = !chartData.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity over time</CardTitle>
        <CardDescription>
          Daily counts by action ({empty ? 'no data' : `top ${series.length} shown`})
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            No data for this period
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <BarChart data={chartData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_v, payload) => {
                      const day = payload?.[0]?.payload?.day;
                      return day
                        ? new Date(day).toLocaleDateString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : String(_v);
                    }}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              {series.map((action) => (
                <Bar
                  key={action}
                  dataKey={action}
                  stackId="a"
                  fill={`var(--color-${action})`}
                  radius={[0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
