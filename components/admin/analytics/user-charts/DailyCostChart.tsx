'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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
import { formatCost } from '@/lib/utils/currency';
import { useCurrencyStore } from '@/lib/stores/currencyStore';
import type { UserDailyCostPoint } from '@/types/admin';

interface DailyCostChartProps {
  data: UserDailyCostPoint[];
}

const chartConfig = {
  cost: {
    label: 'Cost',
    color: 'var(--chart-4)',
  },
} satisfies ChartConfig;

export function DailyCostChart({ data }: DailyCostChartProps) {
  const { showNGN, exchangeRate } = useCurrencyStore();

  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Daily Cost</CardTitle>
          <CardDescription>Estimated daily API cost</CardDescription>
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
        <CardTitle>Daily Cost</CardTitle>
        <CardDescription>Estimated daily API cost</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} accessibilityLayer>
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
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) =>
                    new Date(v).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  }
                  formatter={(value) => [
                    formatCost(Number(value), { showNGN, exchangeRate, decimals: 6 }),
                    'Cost',
                  ]}
                />
              }
            />
            <defs>
              <linearGradient id="fillDailyCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-cost)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-cost)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="cost"
              type="monotone"
              fill="url(#fillDailyCost)"
              stroke="var(--color-cost)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
