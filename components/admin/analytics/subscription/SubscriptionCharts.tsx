'use client';

import { SubscriptionsOverTimeChart } from './charts/SubscriptionsOverTimeChart';
import { RevenueOverTimeChart } from './charts/RevenueOverTimeChart';
import { MrrTrendChart } from './charts/MrrTrendChart';
import { PlanDistributionChart } from './charts/PlanDistributionChart';
import { StatusDistributionChart } from './charts/StatusDistributionChart';
import { ChurnOverTimeChart } from './charts/ChurnOverTimeChart';
import type { SubscriptionAnalyticsCharts as ChartsType } from '@/types/admin';

/******************************************************************************
                                 Types
******************************************************************************/

interface SubscriptionChartsProps {
  charts: ChartsType;
  granularity: 'hour' | 'day';
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Composes all subscription analytics charts in a layout
 * grouped by category with section headers.
 */
function SubscriptionCharts({ charts, granularity }: SubscriptionChartsProps) {
  return (
    <div className="space-y-8">
      {/* Growth & Acquisition */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Growth &amp; Acquisition
        </h2>
        <SubscriptionsOverTimeChart
          data={charts.subscriptions_over_time}
          granularity={granularity}
        />
      </section>

      {/* Revenue & MRR */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Revenue &amp; MRR
        </h2>
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
      </section>

      {/* Distribution */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Distribution
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlanDistributionChart data={charts.plan_distribution} />
          <StatusDistributionChart data={charts.status_distribution} />
        </div>
      </section>

      {/* Churn & Retention */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Churn &amp; Retention
        </h2>
        <ChurnOverTimeChart
          data={charts.churn_over_time}
          granularity={granularity}
        />
      </section>
    </div>
  );
}

export { SubscriptionCharts };
