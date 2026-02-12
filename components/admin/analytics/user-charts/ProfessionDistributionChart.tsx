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
import type { ProfessionDistributionPoint } from '@/types/admin';

interface ProfessionDistributionChartProps {
  data: ProfessionDistributionPoint[];
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function ProfessionDistributionChart({
  data,
}: ProfessionDistributionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profession Distribution</CardTitle>
          <CardDescription>Users by profession</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  // Build chart config dynamically from data
  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.profession] = {
      label: item.profession,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {});

  const chartData = data.map((item, index) => ({
    ...item,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profession Distribution</CardTitle>
        <CardDescription>Users by profession</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[300px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="profession"
                  formatter={(value, name) => {
                    const item = data.find((d) => d.profession === name);
                    return [
                      `${Number(value).toLocaleString()} users (${Number(item?.percentage ?? 0).toFixed(1)}%)`,
                      name,
                    ];
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="profession"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.profession} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="profession" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
