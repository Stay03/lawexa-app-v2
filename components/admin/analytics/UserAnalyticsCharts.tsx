'use client';

import { UserGrowthChart } from './user-charts/UserGrowthChart';
import { ActiveUsersOverTimeChart } from './user-charts/ActiveUsersOverTimeChart';
import { UserTypeDistributionChart } from './user-charts/UserTypeDistributionChart';
import { AuthProviderDistributionChart } from './user-charts/AuthProviderDistributionChart';
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
      {/* Row 1: User Growth + Active Users Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserGrowthChart data={charts.user_growth} granularity={granularity} />
        <ActiveUsersOverTimeChart data={charts.active_users_over_time} granularity={granularity} />
      </div>

      {/* Row 2: User Type Distribution + Auth Provider Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UserTypeDistributionChart data={charts.user_type_distribution} />
        <AuthProviderDistributionChart data={charts.auth_provider_distribution} />
      </div>

      {/* Row 3: Conversations & Messages + Token Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversationsAndMessagesChart data={charts.conversations_and_messages} granularity={granularity} />
        <TokenUsageChart data={charts.token_usage} granularity={granularity} />
      </div>

      {/* Row 4: Daily Cost + Country Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyCostChart data={charts.daily_cost} granularity={granularity} />
        <CountryDistributionChart data={charts.country_distribution} />
      </div>

      {/* Row 5: Profession + Area of Study Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProfessionDistributionChart data={charts.profession_distribution} />
        <AreaOfStudyDistributionChart data={charts.area_of_study_distribution} />
      </div>

      {/* Row 6: Law School Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LawSchoolDistributionChart data={charts.law_school_distribution} />
      </div>
    </div>
  );
}

export { UserAnalyticsCharts };
