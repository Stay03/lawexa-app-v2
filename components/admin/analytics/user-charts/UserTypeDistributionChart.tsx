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
import type { UserTypeDistributionPoint } from '@/types/admin';

interface UserTypeDistributionChartProps {
  data: UserTypeDistributionPoint[];
}

const TYPE_COLORS: Record<string, string> = {
  Registered: '#3b82f6',
  Guest: '#a855f7',
};

const FALLBACK_COLOR = '#94a3b8';

export function UserTypeDistributionChart({
  data,
}: UserTypeDistributionChartProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Type</CardTitle>
          <CardDescription>Registered vs Guest breakdown</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const chartConfig = data.reduce<ChartConfig>((acc, item) => {
    acc[item.type] = {
      label: item.type,
      color: TYPE_COLORS[item.type] ?? FALLBACK_COLOR,
    };
    return acc;
  }, {});

  const chartData = data.map((item) => ({
    ...item,
    fill: TYPE_COLORS[item.type] ?? FALLBACK_COLOR,
  }));

  const topEntry = data.reduce((max, d) => (d.count > max.count ? d : max), data[0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Type</CardTitle>
        <CardDescription>Registered vs Guest breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <ChartContainer config={chartConfig} className="h-[140px] w-[140px] shrink-0">
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="type"
                    formatter={(value, name) => {
                      const item = data.find((d) => d.type === name);
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
                nameKey="type"
                innerRadius={38}
                outerRadius={55}
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.type} fill={entry.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) - 8}
                            className="fill-foreground text-lg font-bold"
                          >
                            {total.toLocaleString()}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 10}
                            className="fill-muted-foreground text-[10px]"
                          >
                            Total
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
              <div key={item.type} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="flex-1 text-sm text-foreground">
                  {item.type}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {item.count.toLocaleString()} ({item.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
