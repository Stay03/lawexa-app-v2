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
import type { TargetTypeDistributionPoint } from '@/types/notification';

interface TargetTypeDistributionChartProps {
  data: TargetTypeDistributionPoint[];
}

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const targetTypeLabels: Record<string, string> = {
  all: 'All Users',
  role: 'By Role',
  users: 'Multiple Users',
  user: 'Single User',
};

export function TargetTypeDistributionChart({
  data,
}: TargetTypeDistributionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Target Distribution</CardTitle>
          <CardDescription>Broadcasts by target type</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  // Build chart config dynamically from data
  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    const label = targetTypeLabels[item.target_type] || item.target_type;
    acc[item.target_type] = {
      label,
      color: CHART_COLORS[index % CHART_COLORS.length],
    };
    return acc;
  }, {});

  const chartData = data.map((item, index) => ({
    ...item,
    label: targetTypeLabels[item.target_type] || item.target_type,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Target Distribution</CardTitle>
        <CardDescription>Broadcasts by target type</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="mx-auto h-[300px] w-full"
        >
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="target_type"
                  formatter={(value, name) => {
                    const item = data.find((d) => d.target_type === name);
                    const label =
                      targetTypeLabels[name as string] || name;
                    return [
                      `${Number(value).toLocaleString()} broadcasts (${Number(item?.percentage ?? 0).toFixed(1)}%)`,
                      label,
                    ];
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="target_type"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.target_type} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="target_type" />}
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
