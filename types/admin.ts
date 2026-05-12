// Admin Conversation Management Types
// Based on API documentation: /docs/apiDocs/admin-conversation-api-documentation.md

export interface UsageBreakdown {
  cost: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface ConversationUsage {
  total_cost: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  orchestrator?: UsageBreakdown;
  specialist?: UsageBreakdown;
}

export interface MessageUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  latency_ms: number;
}

export interface AdminAgent {
  id: number;
  model_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  temperature: string | null;
  max_response_tokens: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminWorkflow {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  execution_mode: string | null;
  orchestrator_agent_id: number | null;
  is_default: boolean | null;
  is_active: boolean | null;
  orchestrator_agent: AdminAgent | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminMessageMetadata {
  type?: 'tool_call' | 'tool_result' | 'handover' | 'handover_result';
  tool_name?: string;
  tool_parameters?: Record<string, unknown>;
  success?: boolean;
  latency_ms?: number;
  execution_time_ms?: number;
  iteration?: number;
  target_agent?: string;
  task?: string;
  agent_slug?: string;
  parent_agent?: number;
  context?: 'handover';
  handover_type?: 'consult' | 'transfer';
  // Attachment fields
  file_id?: number;
  file_name?: string;
  file_size?: number;
  file_mime_type?: string;
  extracted_text_length?: number;
}

export interface AdminMessage {
  id: number;
  agent_id: number | null;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  metadata: AdminMessageMetadata | null;
  usage?: MessageUsage | null;
  created_at: string;
}

export interface AdminConversationListItem {
  id: string;
  user_uuid: string;
  title: string | null;
  status: 'active' | 'archived';
  is_private: boolean;
  agent: AdminAgent | null;
  workflow: AdminWorkflow | null;
  messages_count: number;
  attachments_count: number;
  usage?: ConversationUsage;
  created_at: string;
  updated_at: string;
}

export interface AdminConversationDetail extends AdminConversationListItem {
  messages: AdminMessage[];
}

// Query Parameters
export interface AdminConversationsParams {
  status?: 'active' | 'archived';
  is_private?: boolean;
  user_uuid?: string;
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// Pagination
export interface AdminConversationsPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  from: number | null;
  to: number | null;
}

export interface AdminConversationsLinks {
  first: string;
  last: string;
  prev: string | null;
  next: string | null;
}

// API Responses
export interface AdminConversationsListResponse {
  success: boolean;
  message: string;
  data: AdminConversationListItem[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminConversationDetailResponse {
  success: boolean;
  message: string;
  data: AdminConversationDetail;
}

// ============================================
// User Management Types
// ============================================

export interface AdminUserProfile {
  id: number;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  profession: string | null;
  area_of_study: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  law_school: string | null;
  university: string | null;
  level: string | null;
  call_to_bar_year: number | null;
  call_number: string | null;
  other_certifications: string | null;
  work_experience: string | null;
  bio: string | null;
  communication_style: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  twitter_url: string | null;
  facebook_url: string | null;
}

export interface AdminAreaOfExpertise {
  id: number;
  name: string;
  slug: string;
}

export interface AdminUserUsageSummary {
  total_conversations: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  total_requests: number;
}

export interface AdminUserAttributionDetail {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer_url: string | null;
  landing_url: string | null;
  referral_code: string | null;
  referrer_user: { uuid: string; name: string } | null;
  origin_guest_user_id: number | null;
  first_touched_at: string | null;
}

export interface AdminUserDetail {
  id: number;
  uuid: string;
  name: string;
  email: string;
  role: string;
  is_creator: boolean;
  is_verified: boolean;
  auth_provider: string;
  avatar_url: string | null;
  profile: AdminUserProfile | null;
  areas_of_expertise: AdminAreaOfExpertise[];
  conversations_count: number;
  usage_summary: AdminUserUsageSummary;
  attribution: AdminUserAttributionDetail | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserDetailResponse {
  success: boolean;
  message: string;
  data: AdminUserDetail;
}

// ============================================
// User List Types (GET /api/admin/users)
// ============================================

export type TAdminUserSortBy =
  | 'name'
  | 'email'
  | 'role'
  | 'created_at'
  | 'last_seen_at'
  | 'first_touched_at';

export interface IAdminUserListAttribution {
  source: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer_domain: string | null;
  has_referrer_user: boolean;
  first_touched_at: string | null;
}

export interface IAdminUserListItem {
  id: number;
  uuid: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  role: string;
  auth_provider: string;
  is_online: boolean;
  last_seen_at: string | null;
  profession: string | null;
  university: string | null;
  law_school: string | null;
  area_of_study: string | null;
  level: string | null;
  subscription_plan: string | null;
  remaining_messages: number | null;
  has_payg_balance: boolean;
  payg_balance: number;
  country: string | null;
  ip_address: string | null;
  ip_country: string | null;
  ip_country_code: string | null;
  device_type: string | null;
  platform: string | null;
  is_creator: boolean;
  is_verified: boolean;
  source: string;
  attribution: IAdminUserListAttribution | null;
  created_at: string;
}

export interface IAdminUserListParams {
  page?: number;
  per_page?: number;
  search?: string;
  role?: string[];
  auth_provider?: string[];
  profession?: string[];
  country?: string[];
  subscription_plan?: string[];
  is_online?: boolean;
  has_payg_balance?: boolean;
  is_creator?: boolean;
  is_verified?: boolean;
  created_from?: string;
  created_to?: string;
  utm_source?: string[];
  utm_medium?: string[];
  utm_campaign?: string[];
  referred_by?: string;
  sort_by?: TAdminUserSortBy;
  sort_order?: 'asc' | 'desc';
}

export interface IAdminUserListResponse {
  success: boolean;
  message: string;
  data: IAdminUserListItem[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

// User Conversations Query Parameters
export interface AdminUserConversationsParams {
  status?: 'active' | 'archived';
  sort_by?: 'created_at' | 'updated_at' | 'title';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface AdminUserConversationsResponse {
  success: boolean;
  message: string;
  data: AdminConversationListItem[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

// ============================================
// User Token Usage Types
// ============================================

export type TokenUsageGroupBy = 'none' | 'day' | 'week' | 'month' | 'agent' | 'conversation';

export interface AdminUserTokenUsageParams {
  start_date?: string;
  end_date?: string;
  agent_slug?: string;
  group_by?: TokenUsageGroupBy;
  sort_by?: 'created_at' | 'total_tokens' | 'estimated_cost';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface TokenUsageSummary {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  total_requests: number;
}

// Ungrouped record (group_by=none)
export interface TokenUsageRecordUngrouped {
  id: number;
  conversation: {
    uuid: string;
    title: string;
  };
  agent: {
    name: string;
    slug: string;
  };
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  latency_ms: number;
  created_at: string;
}

// Grouped by day/week/month
export interface TokenUsageRecordByPeriod {
  period: string;
  week_start?: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: string;
  request_count: number;
}

// Grouped by agent
export interface TokenUsageRecordByAgent {
  agent_id: number;
  agent_name: string;
  agent_slug: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: string;
  request_count: number;
}

// Grouped by conversation
export interface TokenUsageRecordByConversation {
  conversation_uuid: string;
  conversation_title: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: string;
  request_count: number;
}

export type TokenUsageBreakdownRecord =
  | TokenUsageRecordUngrouped
  | TokenUsageRecordByPeriod
  | TokenUsageRecordByAgent
  | TokenUsageRecordByConversation;

export interface AdminUserTokenUsageResponse {
  success: boolean;
  message: string;
  data: {
    summary: TokenUsageSummary;
    breakdown: TokenUsageBreakdownRecord[];
  };
  pagination: AdminConversationsPagination;
}

// ============================================
// Conversation Analytics Types
// Based on API documentation: /docs/apiDocs/conversation-analytics-api.md
// ============================================

export type AnalyticsPeriod =
  | 'today'
  | 'last_24_hours'
  | 'date'
  | 'this_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_30_days'
  | 'date_range';

export interface ConversationAnalyticsParams {
  period?: AnalyticsPeriod;
  date?: string;
  start_date?: string;
  end_date?: string;
}

export interface AnalyticsPeriodInfo {
  start: string;
  end: string;
  comparison_start: string;
  comparison_end: string;
}

export interface AnalyticsStatCard {
  value: number;
  change_percent: number | null;
}

export interface AnalyticsStatCards {
  total_conversations: AnalyticsStatCard;
  active_users: AnalyticsStatCard;
  avg_response_time: AnalyticsStatCard;
  error_rate: AnalyticsStatCard;
  total_cost: AnalyticsStatCard;
  avg_messages_per_conversation: AnalyticsStatCard;
}

export interface ConversationsOverTimePoint {
  date?: string;
  hour?: string;
  conversations: number;
  unique_users: number;
}

export interface CostAndTokensTrendPoint {
  date?: string;
  hour?: string;
  total_cost: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
}

export interface LatencyDistributionBucket {
  bucket: string;
  count: number;
}

export interface AgentPerformanceRow {
  agent_id: number;
  agent_name: string;
  agent_slug: string;
  request_count: number;
  avg_latency_ms: number;
  total_cost: number;
  avg_tokens: number;
  error_count: number;
}

export interface ModelUsageRow {
  model_name: string;
  model_id: string;
  request_count: number;
  percentage: number;
}

export interface MessageRoleDistributionPoint {
  date?: string;
  hour?: string;
  user_count: number;
  assistant_count: number;
  tool_count: number;
}

export interface ErrorBreakdownRow {
  category: string;
  count: number;
}

export interface AnalyticsCharts {
  conversations_over_time: ConversationsOverTimePoint[];
  cost_and_tokens_trend: CostAndTokensTrendPoint[];
  latency_distribution: LatencyDistributionBucket[];
  agent_performance: AgentPerformanceRow[];
  model_usage: ModelUsageRow[];
  message_role_distribution: MessageRoleDistributionPoint[];
  error_breakdown: ErrorBreakdownRow[];
}

export interface AnalyticsRecentConversation {
  uuid: string;
  title: string | null;
  user_name: string;
  user_uuid: string;
  agent_name: string | null;
  messages_count: number;
  total_cost: number;
  avg_latency_ms: number;
  created_at: string;
}

export interface AnalyticsTopUser {
  uuid: string;
  name: string;
  role: string;
  conversations_count: number;
  total_messages: number;
  total_cost: number;
  last_active: string;
}

export interface AnalyticsTables {
  recent_conversations: AnalyticsRecentConversation[];
  top_users: AnalyticsTopUser[];
}

export interface ConversationAnalyticsData {
  period: AnalyticsPeriodInfo;
  granularity: 'hour' | 'day';
  stat_cards: AnalyticsStatCards;
  charts: AnalyticsCharts;
  tables: AnalyticsTables;
}

export interface ConversationAnalyticsResponse {
  success: boolean;
  message: string;
  data: ConversationAnalyticsData;
}

// ============================================
// User Analytics Types
// Based on API documentation: /docs/apiDocs/user-analytics-api.md
// ============================================

export type UserAnalyticsPeriod = ViewAnalyticsPeriod;

export interface UserAnalyticsParams {
  period?: UserAnalyticsPeriod;
  date?: string;
  start_date?: string;
  end_date?: string;
}

export interface CurrentlyOnlineCard {
  value: number;
  registered: number;
  guest: number;
}

export interface UserCountCard {
  value: number;
  registered: number;
  guest: number;
  change_percent: number | null;
}

export interface ActivationMetric {
  value: number;
  activated_count: number;
  total_signups: number;
  change_percent: number | null;
}

export interface ActivationRateCard {
  ai_activation: ActivationMetric;
  content_activation: ActivationMetric;
}

export interface ReturningUsersCard {
  value: number;
  registered: number;
  guest: number;
  returning_rate: number;
  change_percent: number | null;
}

export interface UserAnalyticsStatCards {
  currently_online: CurrentlyOnlineCard;
  new_users: UserCountCard;
  total_users: UserCountCard;
  activation_rate: ActivationRateCard;
  returning_users: ReturningUsersCard;
  total_conversations: AnalyticsStatCard;
  total_ai_responses: AnalyticsStatCard;
  total_tokens: AnalyticsStatCard;
  total_cost: AnalyticsStatCard;
}

export interface UserGrowthPoint {
  date?: string;
  hour?: string;
  total: number;
  registered: number;
  guest: number;
}

export interface UserTypeDistributionPoint {
  type: string;
  count: number;
  percentage: number;
}

export interface ActiveUsersOverTimePoint {
  date?: string;
  hour?: string;
  total: number;
  registered: number;
  guest: number;
}

export interface AuthProviderDistributionPoint {
  provider: string;
  count: number;
  percentage: number;
}

export interface UserConversationsAndMessagesPoint {
  date?: string;
  hour?: string;
  conversations: number;
  messages: number;
}

export interface UserTokenUsagePoint {
  date?: string;
  hour?: string;
  total_tokens: number;
}

export interface UserDailyCostPoint {
  date?: string;
  hour?: string;
  cost: number;
}

export interface ProfessionDistributionPoint {
  profession: string;
  count: number;
  percentage: number;
}

export interface AreaOfStudyDistributionPoint {
  area_of_study: string;
  count: number;
  percentage: number;
}

export interface CountryDistributionPoint {
  country: string;
  count: number;
  percentage: number;
}

export interface LawSchoolDistributionPoint {
  law_school: string;
  count: number;
  percentage: number;
}

export interface UserAnalyticsCharts {
  user_growth: UserGrowthPoint[];
  user_type_distribution: UserTypeDistributionPoint[];
  active_users_over_time: ActiveUsersOverTimePoint[];
  auth_provider_distribution: AuthProviderDistributionPoint[];
  conversations_and_messages: UserConversationsAndMessagesPoint[];
  token_usage: UserTokenUsagePoint[];
  daily_cost: UserDailyCostPoint[];
  profession_distribution: ProfessionDistributionPoint[];
  area_of_study_distribution: AreaOfStudyDistributionPoint[];
  country_distribution: CountryDistributionPoint[];
  law_school_distribution: LawSchoolDistributionPoint[];
}

export interface UserDailyBreakdownRow {
  date?: string;
  hour?: string;
  new_users: number;
  new_guests: number;
  conversations: number;
  messages: number;
  ai_responses: number;
  total_tokens: number;
  cost: number;
}

export interface UserUniversityRow {
  university: string;
  count: number;
  percentage: number;
  country: string | null;
}

export interface UserAnalyticsTables {
  daily_breakdown: UserDailyBreakdownRow[];
  top_universities: UserUniversityRow[];
  international_universities: UserUniversityRow[];
}

export interface UserAnalyticsData {
  period: AnalyticsPeriodInfo;
  granularity: ViewAnalyticsGranularity;
  stat_cards: UserAnalyticsStatCards;
  charts: UserAnalyticsCharts;
  tables: UserAnalyticsTables;
}

export interface UserAnalyticsResponse {
  success: boolean;
  message: string;
  data: UserAnalyticsData;
}

// ============================================
// View Analytics Types
// Based on API documentation: /docs/apiDocs/view-analytics-api.md
// ============================================

export type ViewAnalyticsPeriod =
  | 'today'
  | 'last_24_hours'
  | 'date'
  | 'this_week'
  | 'last_7_days'
  | 'this_month'
  | 'last_30_days'
  | 'date_range';

export interface ViewAnalyticsParams {
  period?: ViewAnalyticsPeriod;
  date?: string;
  start_date?: string;
  end_date?: string;
}

export interface ViewAnalyticsStatCards {
  total_views: AnalyticsStatCard;
  unique_visitors: AnalyticsStatCard;
  unique_bot_crawlers: AnalyticsStatCard;
  human_views: AnalyticsStatCard;
  bot_views: AnalyticsStatCard;
  search_engine_crawls: AnalyticsStatCard;
  social_media_crawls: AnalyticsStatCard;
  internal_search_views: AnalyticsStatCard;
  countries_reached: AnalyticsStatCard;
}

// Chart Data Interfaces

export interface ViewsOverTimePoint {
  date?: string;
  hour?: string;
  human_views: number;
  bot_views: number;
  total_views: number;
}

export interface BotCrawlsOverTimePoint {
  date?: string;
  hour?: string;
  search_engine_crawls: number;
  social_media_crawls: number;
  total_crawls: number;
}

export interface ViewsByContentTypePoint {
  type: string;
  count: number;
  percentage: number;
}

export interface DeviceBreakdownPoint {
  device_type: string;
  count: number;
  percentage: number;
}

export interface BrowserUsagePoint {
  browser: string;
  count: number;
  percentage: number;
}

export interface HumanVsBotPoint {
  category: string;
  count: number;
  percentage: number;
}

export interface BotBreakdownPoint {
  category: string;
  count: number;
  percentage: number;
}

export interface ViewsByCountryPoint {
  country: string;
  count: number;
}

export interface ViewsByContinentPoint {
  continent: string;
  count: number;
}

export interface ViewsByProfessionPoint {
  profession: string;
  count: number;
  percentage: number;
}

export interface ProfileCountryVsIpCountryData {
  profile_countries: ViewsByCountryPoint[];
  ip_countries: ViewsByCountryPoint[];
}

export interface ViewsByUniversityChartPoint {
  university: string;
  count: number;
  percentage: number;
}

export interface ViewAnalyticsCharts {
  views_over_time: ViewsOverTimePoint[];
  views_by_content_type: ViewsByContentTypePoint[];
  device_breakdown: DeviceBreakdownPoint[];
  browser_usage: BrowserUsagePoint[];
  human_vs_bot: HumanVsBotPoint[];
  bot_breakdown: BotBreakdownPoint[];
  bot_crawls_over_time: BotCrawlsOverTimePoint[];
  bot_views_by_country: ViewsByCountryPoint[];
  views_by_country: ViewsByCountryPoint[];
  views_by_continent: ViewsByContinentPoint[];
  views_by_profession: ViewsByProfessionPoint[];
  profile_country_vs_ip_country: ProfileCountryVsIpCountryData;
  views_by_university: ViewsByUniversityChartPoint[];
}

// Table Data Interfaces

export interface TopViewedContentRow {
  viewable_type: string;
  viewable_id: number;
  view_count: number;
  title: string | null;
  slug: string | null;
}

export interface TopCrawledContentRow {
  viewable_type: string;
  viewable_id: number;
  crawl_count: number;
  title: string | null;
  slug: string | null;
}

export interface RecentViewRow {
  viewer_name: string | null;
  profession: string | null;
  profile_country: string | null;
  viewable_type: string;
  viewable_id: number;
  title: string | null;
  slug: string | null;
  device_type: string | null;
  browser: string | null;
  ip_country: string | null;
  is_bot: boolean;
  viewed_at: string;
}

export interface TopViewerRow {
  uuid: string;
  name: string;
  email: string | null;
  profession: string | null;
  view_count: number;
  is_guest: boolean;
}

export interface TopSearchQueryRow {
  search_query: string;
  count: number;
}

export interface BotActivityRow {
  bot_name: string | null;
  bot_type: string;
  viewable_type: string;
  viewable_id: number;
  title: string | null;
  slug: string | null;
  viewed_at: string;
}

export interface TopBotRow {
  bot_name: string;
  bot_type: 'search_engine' | 'social_media' | 'other';
  count: number;
}

export interface ViewsByCityRow {
  city: string;
  region: string | null;
  country: string | null;
  count: number;
}

export interface TopUniversityViewRow {
  university: string;
  view_count: number;
  unique_viewers: number;
}

export interface ViewAnalyticsTables {
  top_viewed_content: TopViewedContentRow[];
  top_crawled_content: TopCrawledContentRow[];
  recent_views: RecentViewRow[];
  top_viewers: TopViewerRow[];
  top_bots: TopBotRow[];
  top_search_queries: TopSearchQueryRow[];
  bot_activity: BotActivityRow[];
  views_by_city: ViewsByCityRow[];
  top_universities: TopUniversityViewRow[];
}

export type ViewAnalyticsGranularity = 'hour' | 'day';

export interface ViewAnalyticsData {
  period: AnalyticsPeriodInfo;
  granularity: ViewAnalyticsGranularity;
  stat_cards: ViewAnalyticsStatCards;
  charts: ViewAnalyticsCharts;
  tables: ViewAnalyticsTables;
}

export interface ViewAnalyticsResponse {
  success: boolean;
  message: string;
  data: ViewAnalyticsData;
}

// ============================================
// Subscription Analytics Types
// Based on API documentation: /docs/apiDocs/subscription-analytics.md
// ============================================

export type SubscriptionAnalyticsPeriod = AnalyticsPeriod;

export interface SubscriptionAnalyticsParams {
  period?: SubscriptionAnalyticsPeriod;
  date?: string;
  start_date?: string;
  end_date?: string;
}

export interface SubscriptionAnalyticsStatCards {
  total_subscriptions: AnalyticsStatCard;
  active_subscriptions: AnalyticsStatCard;
  new_subscriptions: AnalyticsStatCard;
  churned_subscriptions: AnalyticsStatCard;
  mrr: AnalyticsStatCard;
  revenue: AnalyticsStatCard;
  churn_rate: AnalyticsStatCard;
  avg_revenue_per_user: AnalyticsStatCard;
}

export interface SubscriptionsOverTimePoint {
  date: string;
  count: number;
}

export interface RevenueOverTimePoint {
  date: string;
  revenue: number;
}

export interface MrrTrendPoint {
  date: string;
  mrr: number;
}

export interface PlanDistributionPoint {
  plan_name: string;
  count: number;
  percentage: number;
  total_amount: number;
}

export interface StatusDistributionPoint {
  status: string;
  label: string;
  count: number;
  percentage: number;
}

export interface ChurnOverTimePoint {
  date: string;
  count: number;
}

export interface SubscriptionAnalyticsCharts {
  subscriptions_over_time: SubscriptionsOverTimePoint[];
  revenue_over_time: RevenueOverTimePoint[];
  mrr_trend: MrrTrendPoint[];
  plan_distribution: PlanDistributionPoint[];
  status_distribution: StatusDistributionPoint[];
  churn_over_time: ChurnOverTimePoint[];
}

export interface PlanBreakdownRow {
  plan_name: string;
  active_count: number;
  new_in_period: number;
  churned_in_period: number;
  revenue_in_period: number;
  mrr_contribution: number;
}

export interface RecentSubscriptionRow {
  id: number;
  user_name: string;
  user_email: string;
  user_uuid: string;
  plan_name: string;
  status: string;
  status_label: string;
  amount: number;
  currency: string;
  created_at: string;
}

export interface TopRevenueUserRow {
  user_uuid: string;
  user_name: string;
  user_email: string;
  total_revenue: number;
  invoice_count: number;
}

export interface SubscriptionAnalyticsTables {
  plan_breakdown: PlanBreakdownRow[];
  recent_subscriptions: RecentSubscriptionRow[];
  top_revenue_users: TopRevenueUserRow[];
}

export interface SubscriptionAnalyticsData {
  period: AnalyticsPeriodInfo;
  granularity: 'hour' | 'day';
  stat_cards: SubscriptionAnalyticsStatCards;
  charts: SubscriptionAnalyticsCharts;
  tables: SubscriptionAnalyticsTables;
}

export interface SubscriptionAnalyticsResponse {
  success: boolean;
  message: string;
  data: SubscriptionAnalyticsData;
}

// ============================================
// Admin Subscription Management Types
// Based on API documentation: /docs/apiDocs/admin-subscription-api.md
// ============================================

export interface AdminSubscriptionUser {
  uuid: string;
  name: string;
  email: string;
}

export interface AdminSubscriptionDetailUser extends AdminSubscriptionUser {
  role: string;
  avatar_url: string | null;
}

export interface AdminSubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description: string;
  amount: string;
  formatted_amount: string;
  currency: string;
  interval: string;
  interval_label: string;
  interval_count: number;
  is_free: boolean;
  is_featured: boolean;
  features: string[];
  limits: { type: string; value: number; is_unlimited: boolean; period: string }[];
}

export type AdminSubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'trialing';

export interface AdminSubscriptionListItem {
  id: number;
  subscription_code: string | null;
  user: AdminSubscriptionUser;
  plan: AdminSubscriptionPlan;
  status: AdminSubscriptionStatus;
  status_label: string;
  amount: string;
  currency: string;
  start_date: string | null;
  next_payment_date: string | null;
  cancelled_at: string | null;
  ends_at: string | null;
  days_until_renewal: number | null;
  is_in_grace_period: boolean;
  has_access: boolean;
  invoices_count: number;
  created_at: string;
}

export interface AdminSubscriptionInvoice {
  id: number;
  invoice_code: string;
  amount: string;
  currency: string;
  formatted_amount: string;
  status: string;
  paid: boolean;
  paid_at: string | null;
  period_start: string | null;
  period_end: string | null;
  transaction_reference: string | null;
  created_at: string;
}

export interface AdminSubscriptionDetail extends AdminSubscriptionListItem {
  email_token: string | null;
  authorization_code: string | null;
  invoice_limit: number;
  cron_expression: string | null;
  quantity: number;
  user: AdminSubscriptionDetailUser;
  recent_invoices: AdminSubscriptionInvoice[];
  updated_at: string;
}

// Query Parameters

export interface AdminSubscriptionsParams {
  status?: AdminSubscriptionStatus;
  plan_id?: number;
  search?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  sort_by?: 'created_at' | 'amount' | 'start_date' | 'next_payment_date';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

// API Responses

export interface AdminSubscriptionsListResponse {
  success: boolean;
  message: string;
  data: AdminSubscriptionListItem[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminSubscriptionDetailResponse {
  success: boolean;
  message: string;
  data: AdminSubscriptionDetail;
}

// ============================================
// Admin Message Pack (PAYG) Types
// Based on API documentation: /docs/apiDocs/admin-message-pack.md
// ============================================

export type MessagePackStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface AdminMessagePackUser {
  uuid: string;
  name: string;
  email: string;
}

export interface AdminMessagePackDetailUser extends AdminMessagePackUser {
  role: string;
  avatar_url: string | null;
}

export interface AdminMessagePackListItem {
  id: number;
  user: AdminMessagePackUser;
  quantity: number;
  messages_total: number;
  messages_remaining: number;
  messages_consumed: number;
  amount: number;
  formatted_amount: string;
  currency: string;
  status: MessagePackStatus;
  status_label: string;
  paid_at: string | null;
  created_at: string;
}

export interface AdminMessagePackDetail extends Omit<AdminMessagePackListItem, 'user'> {
  user: AdminMessagePackDetailUser;
  transaction_reference: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string;
}

// Query Parameters

export interface AdminMessagePacksParams {
  status?: MessagePackStatus;
  search?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  sort_by?: 'created_at' | 'amount' | 'paid_at' | 'messages_total';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface MessagePackAnalyticsParams {
  period?: AnalyticsPeriod;
  date?: string;
  start_date?: string;
  end_date?: string;
}

// Analytics Stat Cards

export interface MessagePackAnalyticsStatCards {
  total_revenue: AnalyticsStatCard;
  total_packs_sold: AnalyticsStatCard;
  total_messages_purchased: AnalyticsStatCard;
  total_messages_consumed: AnalyticsStatCard;
  consumption_rate: AnalyticsStatCard;
  avg_pack_size: AnalyticsStatCard;
}

// Analytics Chart Types

export interface MessagePackRevenueOverTimePoint {
  date?: string;
  hour?: string;
  revenue: number;
}

export interface MessagePackPurchasesOverTimePoint {
  date?: string;
  hour?: string;
  count: number;
}

export interface MessagePackStatusDistributionPoint {
  status: string;
  label: string;
  count: number;
  percentage: number;
}

export interface MessagePackAnalyticsCharts {
  revenue_over_time: MessagePackRevenueOverTimePoint[];
  purchases_over_time: MessagePackPurchasesOverTimePoint[];
  status_distribution: MessagePackStatusDistributionPoint[];
}

// Analytics Table Types

export interface MessagePackTopBuyerRow {
  user_uuid: string;
  user_name: string | null;
  user_email: string | null;
  is_deleted: boolean;
  total_spent: number;
  total_messages: number;
  pack_count: number;
}

export interface MessagePackRecentPurchaseRow {
  id: number;
  user_name: string | null;
  user_email: string | null;
  user_uuid: string | null;
  is_deleted: boolean;
  quantity: number;
  messages_total: number;
  amount: number;
  currency: string;
  paid_at: string;
}

export interface MessagePackAnalyticsTables {
  top_buyers: MessagePackTopBuyerRow[];
  recent_purchases: MessagePackRecentPurchaseRow[];
}

// Full Analytics Data

export interface MessagePackAnalyticsData {
  period: AnalyticsPeriodInfo;
  granularity: 'hour' | 'day';
  stat_cards: MessagePackAnalyticsStatCards;
  charts: MessagePackAnalyticsCharts;
  tables: MessagePackAnalyticsTables;
}

// API Responses

export interface AdminMessagePacksListResponse {
  success: boolean;
  message: string;
  data: AdminMessagePackListItem[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminMessagePackDetailResponse {
  success: boolean;
  message: string;
  data: AdminMessagePackDetail;
}

export interface MessagePackAnalyticsResponse {
  success: boolean;
  message: string;
  data: MessagePackAnalyticsData;
}
