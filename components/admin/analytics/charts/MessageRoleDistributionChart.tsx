'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
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
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel } from '@/lib/utils/analytics';

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

export function MessageRoleDistributionChart({
  data,
  granularity,
}: MessageRoleDistributionChartProps) {
  const isHourly = granularity === 'hour';
  // Hourly points cross midnight in "last 24 hours": the midnight tick then names its day.
  const spansDays = isHourly && bucketsSpanDays(data.map((point) => point.date));

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
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => formatDateTick(String(v), granularity, spansDays)}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_v, payload) =>
                    formatDateTooltipLabel(String(payload?.[0]?.payload?.date ?? _v), granularity)
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="user_count"
              type="monotone"
              stroke="var(--color-user_count)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              dataKey="assistant_count"
              type="monotone"
              stroke="var(--color-assistant_count)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              dataKey="tool_count"
              type="monotone"
              stroke="var(--color-tool_count)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
