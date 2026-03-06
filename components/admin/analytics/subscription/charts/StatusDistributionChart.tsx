'use client';

import { Pie, PieChart, Cell } from 'recharts';
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
import type { StatusDistributionPoint } from '@/types/admin';

interface StatusDistributionChartProps {
  data: StatusDistributionPoint[];
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  past_due: '#f97316',
  cancelled: '#ef4444',
  expired: '#6b7280',
  trialing: '#3b82f6',
};

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
          <CardDescription>All subscriptions by status</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data available
        </CardContent>
      </Card>
    );
  }

  const chartConfig = data.reduce<ChartConfig>((acc, item) => {
    acc[item.label] = {
      label: item.label,
      color: STATUS_COLORS[item.status] ?? 'var(--chart-4)',
    };
    return acc;
  }, {});

  const chartData = data.map((item) => ({
    ...item,
    fill: STATUS_COLORS[item.status] ?? 'var(--chart-4)',
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Distribution</CardTitle>
        <CardDescription>All subscriptions by status</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[300px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="label"
                  formatter={(value, name) => {
                    const item = data.find((d) => d.label === name);
                    return [
                      `${Number(value).toLocaleString()} (${Number(item?.percentage ?? 0).toFixed(1)}%)`,
                      name,
                    ];
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="label"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="label" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
