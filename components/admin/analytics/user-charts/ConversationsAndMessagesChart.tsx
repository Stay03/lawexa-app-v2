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
import type { UserConversationsAndMessagesPoint, ViewAnalyticsGranularity } from '@/types/admin';

interface ConversationsAndMessagesChartProps {
  data: UserConversationsAndMessagesPoint[];
  granularity: ViewAnalyticsGranularity;
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

function formatHour(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function ConversationsAndMessagesChart({
  data,
  granularity,
}: ConversationsAndMessagesChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversations & Messages</CardTitle>
          <CardDescription>Conversations and user messages</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const isHourly = granularity === 'hour';
  const dataKey = isHourly ? 'hour' : 'date';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversations & Messages</CardTitle>
        <CardDescription>Conversations and user messages</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey={dataKey}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                if (isHourly) return formatHour(v);
                const d = new Date(v);
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              }}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => {
                    if (isHourly) return formatHour(v);
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
