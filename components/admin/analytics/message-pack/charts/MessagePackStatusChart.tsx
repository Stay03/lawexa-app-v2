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
import type { MessagePackStatusDistributionPoint } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  pending: '#f97316',
  failed: '#ef4444',
  refunded: '#3b82f6',
};

/******************************************************************************
                                 Types
******************************************************************************/

interface MessagePackStatusChartProps {
  data: MessagePackStatusDistributionPoint[];
}

/******************************************************************************
                                 Component
******************************************************************************/

export function MessagePackStatusChart({ data }: MessagePackStatusChartProps) {
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.count, 0),
    [data]
  );

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Status Distribution</CardTitle>
          <CardDescription>All message packs by status</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] flex-col items-center justify-center gap-2 text-muted-foreground">
          <PieChartIcon className="h-8 w-8 opacity-40" />
          <p className="text-sm">No data available</p>
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
        <CardDescription>All message packs by status</CardDescription>
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
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={entry.fill} />
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
            <ChartLegend content={<ChartLegendContent nameKey="label" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
