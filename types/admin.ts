// Admin Conversation Management Types
// Based on API documentation: /docs/apiDocs/admin-conversation-api-documentation.md

export interface ConversationUsage {
  total_cost: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
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
  iteration?: number;
  target_agent?: string;
  task?: string;
  agent_slug?: string;
  parent_agent?: number;
  context?: 'handover';
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
  usage: ConversationUsage;
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
  created_at: string;
  updated_at: string;
}

export interface AdminUserDetailResponse {
  success: boolean;
  message: string;
  data: AdminUserDetail;
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

export type AnalyticsPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface ConversationAnalyticsParams {
  period?: AnalyticsPeriod;
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
  date: string;
  conversations: number;
  unique_users: number;
}

export interface CostAndTokensTrendPoint {
  date: string;
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
  date: string;
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

export type UserAnalyticsParams = ConversationAnalyticsParams;

export interface UserAnalyticsStatCards {
  new_users: AnalyticsStatCard;
  total_conversations: AnalyticsStatCard;
  total_ai_responses: AnalyticsStatCard;
  total_tokens: AnalyticsStatCard;
  total_cost: AnalyticsStatCard;
}

export interface UserGrowthPoint {
  date: string;
  count: number;
}

export interface UserConversationsAndMessagesPoint {
  date: string;
  conversations: number;
  messages: number;
}

export interface UserTokenUsagePoint {
  date: string;
  total_tokens: number;
}

export interface UserDailyCostPoint {
  date: string;
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
  conversations_and_messages: UserConversationsAndMessagesPoint[];
  token_usage: UserTokenUsagePoint[];
  daily_cost: UserDailyCostPoint[];
  profession_distribution: ProfessionDistributionPoint[];
  area_of_study_distribution: AreaOfStudyDistributionPoint[];
  country_distribution: CountryDistributionPoint[];
  law_school_distribution: LawSchoolDistributionPoint[];
}

export interface UserDailyBreakdownRow {
  date: string;
  new_users: number;
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
  stat_cards: UserAnalyticsStatCards;
  charts: UserAnalyticsCharts;
  tables: UserAnalyticsTables;
}

export interface UserAnalyticsResponse {
  success: boolean;
  message: string;
  data: UserAnalyticsData;
}
