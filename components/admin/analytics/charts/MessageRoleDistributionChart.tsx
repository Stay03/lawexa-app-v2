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
import type { MessageRoleDistributionPoint } from '@/types/admin';

interface MessageRoleDistributionChartProps {
  data: MessageRoleDistributionPoint[];
  granularity: 'hour' | 'day';
}

const chartConfig = {
  user_count: {
    label: 'User',
    color: 'var(--chart-1)',
  },
  assistant_count: {
    label: 'Assistant',
    color: 'var(--chart-2)',
  },
  tool_count: {
    label: 'Tool',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

function formatHourLabel(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function MessageRoleDistributionChart({
  data,
  granularity,
}: MessageRoleDistributionChartProps) {
  const isHourly = granularity === 'hour';
  const xKey = isHourly ? 'hour' : 'date';

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Message Distribution</CardTitle>
          <CardDescription>Messages by role over time</CardDescription>
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
        <CardTitle>Message Distribution</CardTitle>
        <CardDescription>Messages by role over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                if (isHourly) return formatHourLabel(v);
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
                    if (isHourly) return formatHourLabel(String(pt?.hour ?? _v));
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
            <Area
              dataKey="tool_count"
              type="monotone"
              fill="var(--color-tool_count)"
              fillOpacity={0.2}
              stroke="var(--color-tool_count)"
              strokeWidth={2}
              stackId="1"
            />
            <Area
              dataKey="assistant_count"
              type="monotone"
              fill="var(--color-assistant_count)"
              fillOpacity={0.2}
              stroke="var(--color-assistant_count)"
              strokeWidth={2}
              stackId="1"
            />
            <Area
              dataKey="user_count"
              type="monotone"
              fill="var(--color-user_count)"
              fillOpacity={0.2}
              stroke="var(--color-user_count)"
              strokeWidth={2}
              stackId="1"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
