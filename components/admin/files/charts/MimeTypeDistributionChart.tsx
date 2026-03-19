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
import { formatBytes } from '@/lib/utils/format-bytes';
import type { FileMimeTypeDistributionPoint } from '@/types/admin-files';

interface MimeTypeDistributionChartProps {
  data: FileMimeTypeDistributionPoint[];
}

const CHART_COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6'];

function shortenMime(mime: string): string {
  const parts = mime.split('/');
  return parts.length > 1 ? parts[1].toUpperCase() : mime;
}

export function MimeTypeDistributionChart({ data }: MimeTypeDistributionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>MIME Type Distribution</CardTitle>
          <CardDescription>Files by MIME type</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const topItem = data.reduce((max, item) => (item.count > max.count ? item : max), data[0]);

  const chartConfig = data.reduce<ChartConfig>((acc, item, index) => {
    acc[item.mime_type] = {
      label: shortenMime(item.mime_type),
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
        <CardTitle>MIME Type Distribution</CardTitle>
        <CardDescription>Files by MIME type</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <ChartContainer config={chartConfig} className="h-[140px] w-[140px] shrink-0">
            <PieChart accessibilityLayer>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey="mime_type"
                    formatter={(value, name) => {
                      const item = data.find((d) => d.mime_type === name);
                      return [
                        `${Number(value).toLocaleString()} (${Number(item?.percentage ?? 0).toFixed(1)}%) — ${formatBytes(item?.total_size ?? 0)}`,
                        shortenMime(String(name)),
                      ];
                    }}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="mime_type"
                innerRadius={38}
                outerRadius={55}
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.mime_type} fill={entry.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 6} className="fill-foreground text-lg font-bold">
                            {Math.round(topItem.percentage)}%
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 10} className="fill-muted-foreground text-[10px]">
                            {shortenMime(topItem.mime_type)}
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
              <div key={item.mime_type} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.fill }} />
                <span className="flex-1 text-sm text-foreground truncate" title={item.mime_type}>
                  {shortenMime(item.mime_type)}
                </span>
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
