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
import type { ViewsOverTimePoint, ViewAnalyticsGranularity } from '@/types/admin';

interface ViewsOverTimeChartProps {
  data: ViewsOverTimePoint[];
  granularity: ViewAnalyticsGranularity;
}

const chartConfig = {
  human_views: {
    label: 'Human Views',
    color: 'var(--chart-1)',
  },
  bot_views: {
    label: 'Bot Views',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

/**
 * Format hour string ("00"-"23") to readable time.
 */
function formatHour(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function ViewsOverTimeChart({ data, granularity }: ViewsOverTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Views Over Time</CardTitle>
          <CardDescription>Human and bot traffic over the selected period</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const isHourly = granularity === 'hour';
  const dataKey = isHourly ? 'hour' : 'date';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Views Over Time</CardTitle>
        <CardDescription>Human and bot traffic over the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={dataKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                if (isHourly) return formatHour(v);
                const d = new Date(v);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_v, payload) => {
                    const pt = payload?.[0]?.payload;
                    if (isHourly) return formatHour(String(pt?.hour ?? _v));
                    return new Date(pt?.date ?? _v).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillHumanViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-human_views)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-human_views)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillBotViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-bot_views)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-bot_views)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="human_views"
              type="monotone"
              fill="url(#fillHumanViews)"
              stroke="var(--color-human_views)"
              strokeWidth={2}
              stackId="views"
            />
            <Area
              dataKey="bot_views"
              type="monotone"
              fill="url(#fillBotViews)"
              stroke="var(--color-bot_views)"
              strokeWidth={2}
              stackId="views"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
