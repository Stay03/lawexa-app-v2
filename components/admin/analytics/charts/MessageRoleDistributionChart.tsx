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

export function MessageRoleDistributionChart({
  data,
}: MessageRoleDistributionChartProps) {
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
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                const d = new Date(v);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => {
                    return new Date(v).toLocaleDateString('en-US', {
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
