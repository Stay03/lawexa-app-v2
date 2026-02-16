'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ViewsByContinentPoint } from '@/types/admin';

interface ViewsByContinentChartProps {
  data: ViewsByContinentPoint[];
}

const BAR_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#06b6d4', '#ec4899'];

export function ViewsByContinentChart({ data }: ViewsByContinentChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Views by Continent</CardTitle>
          <CardDescription>Geographic distribution by continent</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Views by Continent</CardTitle>
        <CardDescription>Geographic distribution by continent</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => {
            const barColor = BAR_COLORS[index % BAR_COLORS.length];
            const barWidthPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
            return (
              <div key={item.continent} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-foreground truncate">
                    {item.continent}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground whitespace-nowrap shrink-0">
                    {item.count.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/50">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${barWidthPercent}%`, backgroundColor: barColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
