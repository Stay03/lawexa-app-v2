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
import type { LawSchoolDistributionPoint } from '@/types/admin';

interface LawSchoolDistributionChartProps {
  data: LawSchoolDistributionPoint[];
}

const CHART_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#f97316',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#eab308',
];

const OTHER_COLOR = '#64748b';
const TOP_N = 5;

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

  const topItem = data.reduce(
    (max, item) => (item.count > max.count ? item : max),
    data[0]
  );

  // Aggregate: top N + "Other"
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const topItems = sorted.slice(0, TOP_N);
  const restItems = sorted.slice(TOP_N);

  const displayData = topItems.map((item, index) => ({
    ...item,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (restItems.length > 0) {
    displayData.push({
      law_school: 'Other',
      count: restItems.reduce((sum, d) => sum + d.count, 0),
      percentage: restItems.reduce((sum, d) => sum + d.percentage, 0),
      fill: OTHER_COLOR,
    });
  }

  const chartConfig = displayData.reduce<ChartConfig>((acc, item) => {
    acc[item.law_school] = {
      label: item.law_school,
      color: item.fill,
    };
    return acc;
  }, {});

  const centerLabel =
    topItem.law_school.length > 14
      ? topItem.law_school.slice(0, 12) + '...'
      : topItem.law_school;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Law School Distribution</CardTitle>
        <CardDescription>Users by law school</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Donut chart */}
          <ChartContainer
            config={chartConfig}
            className="h-[140px] w-[140px] shrink-0"
          >
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="law_school"
                    formatter={(value, name) => {
                      const item = displayData.find(
                        (d) => d.law_school === name
                      );
                      return [
                        `${Number(value).toLocaleString()} users (${Number(item?.percentage ?? 0).toFixed(1)}%)`,
                        name,
                      ];
                    }}
                  />
                }
              />
              <Pie
                data={displayData}
                dataKey="count"
                nameKey="law_school"
                innerRadius={38}
                outerRadius={55}
                strokeWidth={2}
              >
                {displayData.map((entry) => (
                  <Cell key={entry.law_school} fill={entry.fill} />
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
                            {Math.round(topItem.percentage)}%
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 10}
                            className="fill-muted-foreground text-[10px]"
                          >
                            {centerLabel}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>

          {/* Legend */}
          <div className="flex flex-1 flex-col gap-2.5">
            {displayData.map((item) => (
              <div key={item.law_school} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="flex-1 text-sm text-foreground truncate">
                  {item.law_school}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap">
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
