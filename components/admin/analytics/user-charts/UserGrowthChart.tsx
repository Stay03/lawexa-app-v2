'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import type { UserGrowthPoint, ViewAnalyticsGranularity } from '@/types/admin';
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks } from '@/lib/utils/analytics';

interface UserGrowthChartProps {
  data: UserGrowthPoint[];
  granularity: ViewAnalyticsGranularity;
}

const chartConfig = {
  registered: {
    label: 'Registered',
    color: 'var(--chart-1)',
  },
  guest: {
    label: 'Guest',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

export function UserGrowthChart({ data, granularity }: UserGrowthChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Growth</CardTitle>
          <CardDescription>New registrations</CardDescription>
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
        <CardTitle>User Growth</CardTitle>
        <CardDescription>New registrations</CardDescription>
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
            <Bar
              dataKey="registered"
              fill="var(--color-registered)"
              radius={[0, 0, 0, 0]}
              stackId="growth"
            />
            <Bar
              dataKey="guest"
              fill="var(--color-guest)"
              radius={[4, 4, 0, 0]}
              stackId="growth"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
