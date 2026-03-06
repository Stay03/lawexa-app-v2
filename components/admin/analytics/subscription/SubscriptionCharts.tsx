'use client';

import { SubscriptionsOverTimeChart } from './charts/SubscriptionsOverTimeChart';
import { RevenueOverTimeChart } from './charts/RevenueOverTimeChart';
import { MrrTrendChart } from './charts/MrrTrendChart';
import { PlanDistributionChart } from './charts/PlanDistributionChart';
import { StatusDistributionChart } from './charts/StatusDistributionChart';
import { ChurnOverTimeChart } from './charts/ChurnOverTimeChart';
import type { SubscriptionAnalyticsCharts as ChartsType } from '@/types/admin';

interface SubscriptionChartsProps {
  charts: ChartsType;
  granularity: 'hour' | 'day';
}

/**
 * Default component. Composes all subscription analytics charts in a layout.
 */
function SubscriptionCharts({ charts, granularity }: SubscriptionChartsProps) {
  return (
    <div className="space-y-6">
      {/* Subscriptions over time — full width */}
      <SubscriptionsOverTimeChart
        data={charts.subscriptions_over_time}
        granularity={granularity}
      />

      {/* Revenue + MRR trend — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueOverTimeChart
          data={charts.revenue_over_time}
          granularity={granularity}
        />
        <MrrTrendChart
          data={charts.mrr_trend}
          granularity={granularity}
        />
      </div>

      {/* Plan + Status distribution — side by side donut charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlanDistributionChart data={charts.plan_distribution} />
        <StatusDistributionChart data={charts.status_distribution} />
      </div>

      {/* Churn over time — full width */}
      <ChurnOverTimeChart
        data={charts.churn_over_time}
        granularity={granularity}
      />
    </div>
  );
}

export { SubscriptionCharts };
