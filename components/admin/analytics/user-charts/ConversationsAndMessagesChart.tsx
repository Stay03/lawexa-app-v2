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
import type { UserConversationsAndMessagesPoint } from '@/types/admin';

interface ConversationsAndMessagesChartProps {
  data: UserConversationsAndMessagesPoint[];
}

const chartConfig = {
  conversations: {
    label: 'Conversations',
    color: 'var(--chart-1)',
  },
  messages: {
    label: 'User Messages',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

export function ConversationsAndMessagesChart({
  data,
}: ConversationsAndMessagesChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversations & Messages</CardTitle>
          <CardDescription>Daily conversations and user messages</CardDescription>
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
        <CardTitle>Conversations & Messages</CardTitle>
        <CardDescription>Daily conversations and user messages</CardDescription>
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
                  labelFormatter={(v) =>
                    new Date(v).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillUserConversations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-conversations)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-conversations)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillUserMessages" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-messages)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-messages)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="conversations"
              type="monotone"
              fill="url(#fillUserConversations)"
              stroke="var(--color-conversations)"
              strokeWidth={2}
            />
            <Area
              dataKey="messages"
              type="monotone"
              fill="url(#fillUserMessages)"
              stroke="var(--color-messages)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
