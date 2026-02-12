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
import type { LatencyDistributionBucket } from '@/types/admin';

interface LatencyDistributionChartProps {
  data: LatencyDistributionBucket[];
}

const chartConfig = {
  count: {
    label: 'Requests',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

export function LatencyDistributionChart({
  data,
}: LatencyDistributionChartProps) {
  const hasData = data.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Latency Distribution</CardTitle>
          <CardDescription>Response time buckets</CardDescription>
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
        <CardTitle>Latency Distribution</CardTitle>
        <CardDescription>Response time buckets</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="bucket"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
