'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
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
import type { UserTokenUsagePoint, ViewAnalyticsGranularity } from '@/types/admin';
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks } from '@/lib/utils/analytics';

interface TokenUsageChartProps {
  data: UserTokenUsagePoint[];
  granularity: ViewAnalyticsGranularity;
}

const chartConfig = {
  total_tokens: {
    label: 'Total Tokens',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

export function TokenUsageChart({ data, granularity }: TokenUsageChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Usage</CardTitle>
          <CardDescription>Total tokens consumed</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const isHourly = granularity === 'hour';
  // Hourly points cross midnight in "last 24 hours": the midnight tick then names its day.
  const spansDays = isHourly && bucketsSpanDays(data.map((point) => point.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Usage</CardTitle>
        <CardDescription>Total tokens consumed</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              ticks={hourlyTicks(data.map((point) => point.date), spansDays)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => formatDateTick(String(v), granularity, spansDays)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                const n = Number(v);
                if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
                if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
                return String(n);
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_v, payload) =>
                    formatDateTooltipLabel(String(payload?.[0]?.payload?.date ?? _v), granularity)
                  }
                  formatter={(value) => [
                    Number(value).toLocaleString(),
                    'Tokens',
                  ]}
                />
              }
            />
            <Bar
              dataKey="total_tokens"
              fill="var(--color-total_tokens)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
