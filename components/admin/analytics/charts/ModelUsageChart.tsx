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
import type { ModelUsageRow } from '@/types/admin';

interface ModelUsageChartProps {
  data: ModelUsageRow[];
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function ModelUsageChart({ data }: ModelUsageChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Usage</CardTitle>
          <CardDescription>AI model distribution</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  // Build chart config dynamically from data
  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.model_name] = {
      label: item.model_name,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {});

  // Add fill property to data for the pie chart
  const chartData = data.map((item, index) => ({
    ...item,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Usage</CardTitle>
        <CardDescription>AI model distribution</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[300px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="model_name"
                  formatter={(value, name) => {
                    const item = data.find((d) => d.model_name === name);
                    return [
                      `${Number(value).toLocaleString()} requests (${item?.percentage.toFixed(1)}%)`,
                      name,
                    ];
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="request_count"
              nameKey="model_name"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.model_id} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="model_name" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
