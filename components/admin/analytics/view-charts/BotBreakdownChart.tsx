'use client';

import { Pie, PieChart, Cell, Label } from 'recharts';
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
import type { BotBreakdownPoint } from '@/types/admin';

interface BotBreakdownChartProps {
  data: BotBreakdownPoint[];
}

const CHART_COLORS = ['#3b82f6', '#a855f7', '#94a3b8'];

function formatCategory(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function BotBreakdownChart({ data }: BotBreakdownChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bot Breakdown</CardTitle>
          <CardDescription>Bot traffic by category</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const topCategory = data.reduce((max, item) => (item.count > max.count ? item : max), data[0]);

  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.category] = {
      label: formatCategory(item.category),
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
        <CardTitle>Bot Breakdown</CardTitle>
        <CardDescription>Bot traffic by category</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <ChartContainer config={chartConfig} className="h-[140px] w-[140px] shrink-0">
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="category"
                    formatter={(value, name) => {
                      const item = data.find((d) => d.category === name);
                      return [
                        `${Number(value).toLocaleString()} (${Number(item?.percentage ?? 0).toFixed(1)}%)`,
                        formatCategory(String(name)),
                      ];
                    }}
                  />
                }
              />
              <Pie data={chartData} dataKey="count" nameKey="category" innerRadius={38} outerRadius={55} strokeWidth={2}>
                {chartData.map((entry) => (
                  <Cell key={entry.category} fill={entry.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 6} className="fill-foreground text-lg font-bold">
                            {Math.round(topCategory.percentage)}%
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 10} className="fill-muted-foreground text-[10px]">
                            {formatCategory(topCategory.category)}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="flex flex-1 flex-col gap-2.5">
            {chartData.map((item) => (
              <div key={item.category} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.fill }} />
                <span className="flex-1 text-sm text-foreground">{formatCategory(item.category)}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {item.count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
