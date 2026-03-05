'use client';

import { ConversationsOverTimeChart } from './charts/ConversationsOverTimeChart';
import { CostAndTokensTrendChart } from './charts/CostAndTokensTrendChart';
import { LatencyDistributionChart } from './charts/LatencyDistributionChart';
import { AgentPerformanceTable } from './charts/AgentPerformanceTable';
import { ModelUsageChart } from './charts/ModelUsageChart';
import { MessageRoleDistributionChart } from './charts/MessageRoleDistributionChart';
import { ErrorBreakdownChart } from './charts/ErrorBreakdownChart';
import type { AnalyticsCharts as AnalyticsChartsType } from '@/types/admin';

interface AnalyticsChartsProps {
  charts: AnalyticsChartsType;
  granularity: 'hour' | 'day';
}

/**
 * Default component. Composes all analytics charts in a responsive grid layout.
 */
function AnalyticsCharts({ charts, granularity }: AnalyticsChartsProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: Conversations over time - full width */}
      <ConversationsOverTimeChart data={charts.conversations_over_time} granularity={granularity} />

      {/* Row 2: Cost & Tokens (2/3) + Model Usage (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CostAndTokensTrendChart data={charts.cost_and_tokens_trend} granularity={granularity} />
        </div>
        <ModelUsageChart data={charts.model_usage} />
      </div>

      {/* Row 3: Message Distribution (1/2) + Latency Distribution (1/2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MessageRoleDistributionChart data={charts.message_role_distribution} granularity={granularity} />
        <LatencyDistributionChart data={charts.latency_distribution} />
      </div>

      {/* Row 4: Agent Performance - full width */}
      <AgentPerformanceTable data={charts.agent_performance} />

      {/* Row 5: Error Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ErrorBreakdownChart data={charts.error_breakdown} />
      </div>
    </div>
  );
}

export { AnalyticsCharts };
