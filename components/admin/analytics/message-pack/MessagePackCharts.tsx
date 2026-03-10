'use client';

import { MessagePackRevenueChart } from './charts/MessagePackRevenueChart';
import { MessagePackPurchasesChart } from './charts/MessagePackPurchasesChart';
import { MessagePackStatusChart } from './charts/MessagePackStatusChart';
import type { MessagePackAnalyticsCharts as ChartsType } from '@/types/admin';

/******************************************************************************
                                 Types
******************************************************************************/

interface MessagePackChartsProps {
  charts: ChartsType;
  granularity: 'hour' | 'day';
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Composes all message pack analytics charts in a layout
 * grouped by category with section headers.
 */
function MessagePackCharts({ charts, granularity }: MessagePackChartsProps) {
  return (
    <div className="space-y-8">
      {/* Revenue & Purchases */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Revenue &amp; Purchases
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MessagePackRevenueChart
            data={charts.revenue_over_time}
            granularity={granularity}
          />
          <MessagePackPurchasesChart
            data={charts.purchases_over_time}
            granularity={granularity}
          />
        </div>
      </section>

      {/* Distribution */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Distribution
        </h2>
        <MessagePackStatusChart data={charts.status_distribution} />
      </section>
    </div>
  );
}

export { MessagePackCharts };
