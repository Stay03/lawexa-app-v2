'use client';

import { ViewsOverTimeChart } from './view-charts/ViewsOverTimeChart';
import { ViewsByContentTypeChart } from './view-charts/ViewsByContentTypeChart';
import { DeviceBreakdownChart } from './view-charts/DeviceBreakdownChart';
import { BrowserUsageChart } from './view-charts/BrowserUsageChart';
import { HumanVsBotChart } from './view-charts/HumanVsBotChart';
import { BotBreakdownChart } from './view-charts/BotBreakdownChart';
import { BotCrawlsOverTimeChart } from './view-charts/BotCrawlsOverTimeChart';
import { BotViewsByCountryChart } from './view-charts/BotViewsByCountryChart';
import { ViewsByCountryChart } from './view-charts/ViewsByCountryChart';
import { ViewsByContinentChart } from './view-charts/ViewsByContinentChart';
import { ViewsByProfessionChart } from './view-charts/ViewsByProfessionChart';
import { ProfileVsIpCountryChart } from './view-charts/ProfileVsIpCountryChart';
import { ViewsByUniversityChart } from './view-charts/ViewsByUniversityChart';
import type {
  ViewAnalyticsCharts as ViewAnalyticsChartsType,
  ViewAnalyticsGranularity,
} from '@/types/admin';

interface ViewAnalyticsChartsProps {
  charts: ViewAnalyticsChartsType;
  granularity: ViewAnalyticsGranularity;
}

/**
 * Default component. Composes all view analytics charts in a responsive grid layout.
 */
function ViewAnalyticsCharts({ charts, granularity }: ViewAnalyticsChartsProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: Views over time - full width */}
      <ViewsOverTimeChart data={charts.views_over_time} granularity={granularity} />

      {/* Row 2: Content type + Device breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ViewsByContentTypeChart data={charts.views_by_content_type} />
        <DeviceBreakdownChart data={charts.device_breakdown} />
      </div>

      {/* Row 3: Browser usage + Human vs Bot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BrowserUsageChart data={charts.browser_usage} />
        <HumanVsBotChart data={charts.human_vs_bot} />
      </div>

      {/* Row 4: Views by country + Views by continent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ViewsByCountryChart data={charts.views_by_country} />
        <ViewsByContinentChart data={charts.views_by_continent} />
      </div>

      {/* Row 5: Views by profession + Profile vs IP country */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ViewsByProfessionChart data={charts.views_by_profession} />
        <ProfileVsIpCountryChart data={charts.profile_country_vs_ip_country} />
      </div>

      {/* Row 6: Views by university - full width */}
      <ViewsByUniversityChart data={charts.views_by_university} />

      {/* Row 7: Bot crawls over time - full width */}
      <BotCrawlsOverTimeChart
        data={charts.bot_crawls_over_time}
        granularity={granularity}
      />

      {/* Row 8: Bot breakdown + Bot crawls by country */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BotBreakdownChart data={charts.bot_breakdown} />
        <BotViewsByCountryChart data={charts.bot_views_by_country} />
      </div>
    </div>
  );
}

export { ViewAnalyticsCharts };
