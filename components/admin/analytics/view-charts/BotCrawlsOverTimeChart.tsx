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
import type {
  BotCrawlsOverTimePoint,
  ViewAnalyticsGranularity,
} from '@/types/admin';

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

function formatHour(hour: string): string {
  const h = parseInt(hour, 10);
  if (h === 0) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

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
  const dataKey = isHourly ? 'hour' : 'date';

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
                  labelFormatter={(_v, payload) => {
                    const pt = payload?.[0]?.payload;
                    if (isHourly) return formatHour(String(pt?.hour ?? _v));
                    return new Date(pt?.date ?? _v).toLocaleDateString('en-US', {
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
              <linearGradient id="fillSearchCrawls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-search_engine_crawls)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-search_engine_crawls)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillSocialCrawls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-social_media_crawls)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-social_media_crawls)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="search_engine_crawls"
              type="monotone"
              fill="url(#fillSearchCrawls)"
              stroke="var(--color-search_engine_crawls)"
              strokeWidth={2}
              stackId="crawls"
            />
            <Area
              dataKey="social_media_crawls"
              type="monotone"
              fill="url(#fillSocialCrawls)"
              stroke="var(--color-social_media_crawls)"
              strokeWidth={2}
              stackId="crawls"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
