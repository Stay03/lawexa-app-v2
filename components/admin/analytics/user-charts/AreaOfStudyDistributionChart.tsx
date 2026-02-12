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
import type { AreaOfStudyDistributionPoint } from '@/types/admin';

interface AreaOfStudyDistributionChartProps {
  data: AreaOfStudyDistributionPoint[];
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function AreaOfStudyDistributionChart({
  data,
}: AreaOfStudyDistributionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Area of Study Distribution</CardTitle>
          <CardDescription>Users by area of study</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  // Build chart config dynamically from data
  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.area_of_study] = {
      label: item.area_of_study,
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
        <CardTitle>Area of Study Distribution</CardTitle>
        <CardDescription>Users by area of study</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[300px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="area_of_study"
                  formatter={(value, name) => {
                    const item = data.find((d) => d.area_of_study === name);
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
              nameKey="area_of_study"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.area_of_study} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="area_of_study" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
