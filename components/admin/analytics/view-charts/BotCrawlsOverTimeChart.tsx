'use client';

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
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
import type {
  BotCrawlsOverTimePoint,
  ViewAnalyticsGranularity,
} from '@/types/admin';
import { bucketsSpanDays, formatDateTick, formatDateTooltipLabel, hourlyTicks } from '@/lib/utils/analytics';

interface BotCrawlsOverTimeChartProps {
  data: BotCrawlsOverTimePoint[];
  granularity: ViewAnalyticsGranularity;
}

const chartConfig = {
  search_engine_crawls: {
    label: 'Search Engines',
    color: 'var(--chart-2)',
  },
  social_media_crawls: {
    label: 'Social Media',
    color: 'var(--chart-5)',
  },
} satisfies ChartConfig;

export function BotCrawlsOverTimeChart({
  data,
  granularity,
}: BotCrawlsOverTimeChartProps) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Bot Crawls Over Time</CardTitle>
          <CardDescription>
            Search engine vs social media crawl volume
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No data for this period
        </CardContent>
      </Card>
    );
  }

  const isHourly = granularity === 'hour';
  // Hourly points cross midnight in "last 24 hours": the midnight tick then names its day.
  const spansDays = isHourly && bucketsSpanDays(data.map((point) => point.date));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bot Crawls Over Time</CardTitle>
        <CardDescription>
          Search engine vs social media crawl volume
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={data} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              ticks={hourlyTicks(data.map((point) => point.date), spansDays)}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => formatDateTick(String(v), granularity, spansDays)}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_v, payload) =>
                    formatDateTooltipLabel(String(payload?.[0]?.payload?.date ?? _v), granularity)
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="search_engine_crawls"
              type="monotone"
              stroke="var(--color-search_engine_crawls)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              dataKey="social_media_crawls"
              type="monotone"
              stroke="var(--color-social_media_crawls)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
