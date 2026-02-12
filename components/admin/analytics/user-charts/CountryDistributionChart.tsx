'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import type { CountryDistributionPoint } from '@/types/admin';

interface CountryDistributionChartProps {
  data: CountryDistributionPoint[];
}

const chartConfig = {
  count: {
    label: 'Users',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export function CountryDistributionChart({
  data,
}: CountryDistributionChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Country Distribution</CardTitle>
          <CardDescription>Users by country</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Country Distribution</CardTitle>
        <CardDescription>Users by country</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={data} layout="vertical" accessibilityLayer>
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              type="category"
              dataKey="country"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={120}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, props) => {
                    const item = props?.payload;
                    return [
                      `${Number(value).toLocaleString()} users (${Number(item?.percentage ?? 0).toFixed(1)}%)`,
                      'Users',
                    ];
                  }}
                />
              }
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
