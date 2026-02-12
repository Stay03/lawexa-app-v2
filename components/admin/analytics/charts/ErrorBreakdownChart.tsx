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
import type { ErrorBreakdownRow } from '@/types/admin';

interface ErrorBreakdownChartProps {
  data: ErrorBreakdownRow[];
}

const chartConfig = {
  count: {
    label: 'Errors',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

export function ErrorBreakdownChart({ data }: ErrorBreakdownChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error Breakdown</CardTitle>
          <CardDescription>Errors by category</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No errors in this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Breakdown</CardTitle>
        <CardDescription>Errors by category</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data} layout="vertical" accessibilityLayer>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              type="category"
              dataKey="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={120}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
