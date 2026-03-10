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

function formatHour(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

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
  const dataKey = isHourly ? 'hour' : 'date';

  // API returns `registered` as total (registered + guest), fix to registered-only
  const chartData = data.map((point) => ({
    ...point,
    registered: point.registered - point.guest,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Growth</CardTitle>
        <CardDescription>New registrations</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} accessibilityLayer>
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
