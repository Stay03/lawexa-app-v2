'use client';

import { useMemo } from 'react';
import { Pie, PieChart, Cell, Label } from 'recharts';
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
import { PieChart as PieChartIcon } from 'lucide-react';
import type { PlanDistributionPoint } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

/******************************************************************************
                                 Types
******************************************************************************/

interface PlanDistributionChartProps {
  data: PlanDistributionPoint[];
}

/******************************************************************************
                                 Component
******************************************************************************/

export function PlanDistributionChart({ data }: PlanDistributionChartProps) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.count, 0),
    [data]
  );

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Plan Distribution</CardTitle>
          <CardDescription>Active subscriptions by plan</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <PieChartIcon className="h-8 w-8 opacity-40" />
          <p className="text-sm">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.plan_name] = {
      label: item.plan_name,
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
        <CardTitle>Plan Distribution</CardTitle>
        <CardDescription>Active subscriptions by plan</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="mx-auto h-[300px] w-full">
          <PieChart accessibilityLayer>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="plan_name"
                  formatter={(value, name) => {
                    const item = data.find((d) => d.plan_name === name);
                    return [
                      `${Number(value).toLocaleString()} subs (${Number(item?.percentage ?? 0).toFixed(1)}%)`,
                      name,
                    ];
                  }}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="plan_name"
              innerRadius={60}
              outerRadius={100}
              strokeWidth={2}
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.plan_name} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-bold">
                          {total.toLocaleString()}
                        </tspan>
                        <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 20} className="fill-muted-foreground text-xs">
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="plan_name" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
