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
import type { ConversationsOverTimePoint } from '@/types/admin';

interface ConversationsOverTimeChartProps {
  data: ConversationsOverTimePoint[];
}

const chartConfig = {
  conversations: {
    label: 'Conversations',
    color: 'var(--chart-1)',
  },
  unique_users: {
    label: 'Unique Users',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export function ConversationsOverTimeChart({
  data,
}: ConversationsOverTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversations Over Time</CardTitle>
          <CardDescription>Daily conversations and unique users</CardDescription>
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
        <CardTitle>Conversations Over Time</CardTitle>
        <CardDescription>Daily conversations and unique users</CardDescription>
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
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
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
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillConversations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-conversations)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-conversations)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillUniqueUsers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-unique_users)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-unique_users)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="conversations"
              type="monotone"
              fill="url(#fillConversations)"
              stroke="var(--color-conversations)"
              strokeWidth={2}
            />
            <Area
              dataKey="unique_users"
              type="monotone"
              fill="url(#fillUniqueUsers)"
              stroke="var(--color-unique_users)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
