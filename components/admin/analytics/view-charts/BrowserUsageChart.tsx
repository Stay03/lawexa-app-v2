'use client';

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from 'recharts';
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
import type { BrowserUsagePoint } from '@/types/admin';

interface BrowserUsageChartProps {
  data: BrowserUsagePoint[];
}

const chartConfig = {
  count: {
    label: 'Views',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export function BrowserUsageChart({ data }: BrowserUsageChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Browsers</CardTitle>
          <CardDescription>Human views by browser</CardDescription>
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
        <CardTitle>Browsers</CardTitle>
        <CardDescription>Human views by browser</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data} layout="vertical" accessibilityLayer>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              dataKey="browser"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={80}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    const point = item?.payload as BrowserUsagePoint | undefined;
                    return [
                      `${Number(value).toLocaleString()} (${Number(point?.percentage ?? 0).toFixed(1)}%)`,
                      'Views',
                    ];
                  }}
                />
              }
            />
            <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
