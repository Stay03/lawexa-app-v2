'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import type { CostAndTokensTrendPoint } from '@/types/admin';

interface CostAndTokensTrendChartProps {
  data: CostAndTokensTrendPoint[];
}

const chartConfig = {
  total_cost: {
    label: 'Cost (USD)',
    color: 'var(--chart-1)',
  },
  total_tokens: {
    label: 'Tokens',
    color: 'var(--chart-3)',
  },
} satisfies ChartConfig;

export function CostAndTokensTrendChart({
  data,
}: CostAndTokensTrendChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost & Tokens Trend</CardTitle>
          <CardDescription>Daily cost and token usage</CardDescription>
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
        <CardTitle>Cost & Tokens Trend</CardTitle>
        <CardDescription>Daily cost and token usage</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} accessibilityLayer margin={{ top: 10 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                const d = new Date(v);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis
              yAxisId="cost"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              domain={[0, (max: number) => Math.ceil(max * 1.15)]}
            />
            <YAxis
              yAxisId="tokens"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                const n = Number(v);
                return n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n);
              }}
              domain={[0, (max: number) => Math.ceil(max * 1.15)]}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => {
                    return new Date(v).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    });
                  }}
                  formatter={(value, name) => {
                    if (name === 'total_cost') {
                      return [`$${Number(value).toFixed(4)}`, 'Cost'];
                    }
                    return [Number(value).toLocaleString(), 'Tokens'];
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-total_cost)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-total_cost)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              yAxisId="cost"
              dataKey="total_cost"
              type="monotone"
              fill="url(#fillCost)"
              stroke="var(--color-total_cost)"
              strokeWidth={2}
            />
            <Area
              yAxisId="tokens"
              dataKey="total_tokens"
              type="monotone"
              fill="none"
              stroke="var(--color-total_tokens)"
              strokeWidth={2}
              strokeDasharray="4 4"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
