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
import type { LawSchoolDistributionPoint } from '@/types/admin';

interface LawSchoolDistributionChartProps {
  data: LawSchoolDistributionPoint[];
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

export function LawSchoolDistributionChart({
  data,
}: LawSchoolDistributionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Law School Distribution</CardTitle>
          <CardDescription>Users by law school</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  // Build chart config dynamically from data
  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.law_school] = {
      label: item.law_school,
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
        <CardTitle>Law School Distribution</CardTitle>
        <CardDescription>Users by law school</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[300px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="law_school"
                  formatter={(value, name) => {
                    const item = data.find((d) => d.law_school === name);
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
              nameKey="law_school"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.law_school} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="law_school" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
