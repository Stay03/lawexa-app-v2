'use client';

import { UserGrowthChart } from './user-charts/UserGrowthChart';
import { ConversationsAndMessagesChart } from './user-charts/ConversationsAndMessagesChart';
import { TokenUsageChart } from './user-charts/TokenUsageChart';
import { DailyCostChart } from './user-charts/DailyCostChart';
import { ProfessionDistributionChart } from './user-charts/ProfessionDistributionChart';
import { CountryDistributionChart } from './user-charts/CountryDistributionChart';
import { LawSchoolDistributionChart } from './user-charts/LawSchoolDistributionChart';
import { AreaOfStudyDistributionChart } from './user-charts/AreaOfStudyDistributionChart';
import type { UserAnalyticsCharts as UserAnalyticsChartsType, ViewAnalyticsGranularity } from '@/types/admin';

interface UserAnalyticsChartsProps {
  charts: UserAnalyticsChartsType;
  granularity: ViewAnalyticsGranularity;
}

/**
 * Default component. Composes all user analytics charts in a responsive grid layout.
 */
function UserAnalyticsCharts({ charts, granularity }: UserAnalyticsChartsProps) {
  return (
    <div className="space-y-6">
      {/* Row 1: User Growth + Conversations & Messages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserGrowthChart data={charts.user_growth} granularity={granularity} />
        <ConversationsAndMessagesChart data={charts.conversations_and_messages} granularity={granularity} />
      </div>

      {/* Row 2: Token Usage + Daily Cost */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TokenUsageChart data={charts.token_usage} granularity={granularity} />
        <DailyCostChart data={charts.daily_cost} granularity={granularity} />
      </div>

      {/* Row 3: Profession + Country Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfessionDistributionChart data={charts.profession_distribution} />
        <CountryDistributionChart data={charts.country_distribution} />
      </div>

      {/* Row 4: Law School + Area of Study Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LawSchoolDistributionChart data={charts.law_school_distribution} />
        <AreaOfStudyDistributionChart data={charts.area_of_study_distribution} />
      </div>
    </div>
  );
}

export { UserAnalyticsCharts };
