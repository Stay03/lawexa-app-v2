'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Activity } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LoadFailed } from '@/components/admin/case-enrichments/LoadFailed';
import { useAdminAiSkillUsage } from '@/lib/hooks/useAdminAi';
import type { AdminAiSkillDetail } from '@/types/admin-ai';
import { usageLine } from './skill-model';

const onDemandConfig = {
  loaded: { label: 'Loaded', color: 'var(--chart-1)' },
  offered_not_loaded: { label: 'Offered, not loaded', color: 'var(--chart-3)' },
} satisfies ChartConfig;

const alwaysOnConfig = {
  loads_always_on: { label: 'Turns given in full', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const WINDOWS = [7, 30] as const;

/**
 * How a skill is used, day by day (woz's `GET /{id}/usage`). On demand: the
 * turns it was loaded on, stacked on the turns it was offered but not loaded,
 * which is where a skill Lawexa skips shows up. Always on: the turns it was
 * given in full. One line under the chart says it in words.
 */
export function AiSkillUsageCard({ skill }: { skill: AdminAiSkillDetail }) {
  const [days, setDays] = useState<(typeof WINDOWS)[number]>(7);
  const { data, isLoading, isError, isFetching, refetch } = useAdminAiSkillUsage(skill.id, days);
  const usage = data?.data;
  const onDemand = (usage?.load_mode ?? skill.load_mode) === 'on_demand';
  const rows = (usage?.daily ?? []).map((day) => ({
    date: day.date,
    loaded: Math.max(0, day.offered - day.offered_not_loaded),
    offered_not_loaded: day.offered_not_loaded,
    loads_always_on: day.loads_always_on,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Usage
          </CardTitle>
          <CardDescription className="mt-1.5">
            {usage ? usageLine(usage.load_mode, usage.totals, usage.days) : ' '}
          </CardDescription>
        </div>
        <div role="group" aria-label="Window" className="flex shrink-0 gap-1">
          {WINDOWS.map((window) => (
            <Button
              key={window}
              size="sm"
              variant={days === window ? 'secondary' : 'ghost'}
              aria-pressed={days === window}
              onClick={() => setDays(window)}
            >
              {window} days
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isError && !usage ? (
          <LoadFailed message="The usage did not load." onRetry={() => refetch()} retrying={isFetching} />
        ) : isLoading || !usage ? (
          <Skeleton className="h-[220px] w-full" />
        ) : (
          <ChartContainer config={onDemand ? onDemandConfig : alwaysOnConfig} className="h-[220px] w-full">
            <BarChart data={rows} accessibilityLayer margin={{ left: 4, right: 16, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) =>
                  new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
              />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {/* Each Bar is a direct child: recharts 2 does not look inside a fragment. */}
              {onDemand ? <Bar dataKey="loaded" stackId="turns" fill="var(--color-loaded)" /> : null}
              {onDemand ? (
                <Bar dataKey="offered_not_loaded" stackId="turns" fill="var(--color-offered_not_loaded)" radius={[3, 3, 0, 0]} />
              ) : null}
              {onDemand ? null : <Bar dataKey="loads_always_on" fill="var(--color-loads_always_on)" radius={[3, 3, 0, 0]} />}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
