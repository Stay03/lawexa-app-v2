// Admin AI Management Types
// Based on API documentation: /docs/apiDocs/admin-ai-docs.md

import type {
  AdminConversationsPagination,
  AdminConversationsLinks,
} from './admin';

// ============================================
// Shared
// ============================================

export interface AdminAiMutationResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors?: Record<string, string[]> | null;
}

// ============================================
// AI Providers
// ============================================

export interface AdminAiProvider {
  id: number;
  name: string;
  slug: string;
  base_url: string;
  is_active: boolean;
  models_count: number;
  created_at: string;
  updated_at: string;
}

export interface AdminAiProviderDetail extends AdminAiProvider {
  models: AdminAiModel[];
}

export interface AdminAiProvidersParams {
  active_only?: boolean;
  sort_by?: 'name' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface AdminAiCreateProviderData {
  name: string;
  slug: string;
  base_url: string;
  api_key: string;
  is_active?: boolean;
}

export interface AdminAiUpdateProviderData {
  name?: string;
  slug?: string;
  base_url?: string;
  api_key?: string;
  is_active?: boolean;
}

export interface AdminAiProvidersListResponse {
  success: boolean;
  message: string;
  data: AdminAiProvider[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminAiProviderDetailResponse {
  success: boolean;
  message: string;
  data: AdminAiProviderDetail;
}

export interface AdminAiTestProviderResult {
  success: boolean;
  message: string;
  response_time_ms?: number;
  error?: string;
}

export interface AdminAiTestProviderResponse {
  success: boolean;
  message: string;
  data: AdminAiTestProviderResult;
}

// ============================================
// Provider account limits
// ============================================

/**
 * A provider that publishes no account limits. Only OpenRouter does, and the
 * API says so without calling anyone rather than reporting another provider's
 * 404 as a failure of ours.
 */
export interface AdminAiProviderLimitsUnsupported {
  supported: false;
}

/** The limits read did not come back. */
export interface AdminAiProviderLimitsFailure {
  supported: true;
  success: false;
  /**
   * The status the provider answered with. ABSENT when the request threw
   * before any response arrived, which is a different failure from a refusal
   * and has to read differently.
   */
  status?: number;
  error?: string;
  response_time_ms?: number;
}

/** What the provider says is on the key. */
export interface AdminAiProviderLimitsReading {
  supported: true;
  success: true;
  response_time_ms?: number;
  label?: string | null;
  is_free_tier?: boolean | null;
  /** The cap on the key. NULL MEANS NO CAP, which is the opposite of 0. */
  limit?: number | null;
  /** What is left of `limit`. Null alongside a null limit. */
  limit_remaining?: number | null;
  /**
   * When the cap refills. Typed `unknown` on purpose: the API passes this
   * field through from the vendor untouched, and no live response has been
   * read yet, so the only verified shape is the ISO string in the API's own
   * test fixture. Narrow it at the render site rather than trusting it here.
   */
  limit_reset?: unknown;
  usage?: number | null;
  usage_daily?: number | null;
  usage_weekly?: number | null;
  usage_monthly?: number | null;
}

export type AdminAiProviderLimits =
  | AdminAiProviderLimitsUnsupported
  | AdminAiProviderLimitsFailure
  | AdminAiProviderLimitsReading;

export interface AdminAiProviderLimitsResponse {
  success: boolean;
  message: string;
  data: AdminAiProviderLimits;
}

// ============================================
// AI Models
// ============================================

export interface AdminAiModelProvider {
  id: number;
  name: string;
  slug: string;
  base_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminAiProviderRouting {
  order?: string[];
  allow_fallbacks?: boolean;
}

/**
 * How tool calls are declared to a model, and how its history is wrapped.
 *
 * `native` sends the provider's own tool-call format and no visible markings.
 * `xml` wraps every prior turn in `<message>` tags with a timestamp prefix, and
 * a model that sees that pattern copies it into its own replies (measured on
 * model 211, 21 September 2026: tags on the second turn with the column null,
 * none across 22 messages once it was set to `native`).
 *
 * NULL IS A REAL STATE AND IS NOT THE SAME AS `xml`. Every new model row starts
 * null and falls to the legacy path, which is why this reached production; the
 * server decides what null means, so nothing here may substitute a value for it.
 */
export type AdminAiToolCallingMode = 'native' | 'xml';

export interface AdminAiModel {
  id: number;
  provider_id: number;
  name: string;
  model_id: string;
  input_price_per_1m: string;
  output_price_per_1m: string;
  max_context_tokens: number;
  supports_vision: boolean;
  supports_streaming: boolean;
  /** `null` on a model nobody has set — see {@link AdminAiToolCallingMode}. */
  tool_calling_mode?: AdminAiToolCallingMode | null;
  provider_routing?: AdminAiProviderRouting | null;
  provider?: AdminAiModelProvider;
  created_at: string;
  updated_at: string;
}

export interface AdminAiModelsParams {
  provider_id?: number;
  supports_vision?: boolean;
  supports_streaming?: boolean;
  sort_by?: 'name' | 'input_price_per_1m' | 'output_price_per_1m' | 'max_context_tokens' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface AdminAiCreateModelData {
  provider_id: number;
  name: string;
  model_id: string;
  input_price_per_1m?: number;
  output_price_per_1m?: number;
  max_context_tokens?: number;
  supports_vision?: boolean;
  supports_streaming?: boolean;
  /** Sent on CREATE as well as update: a new row left null is how the legacy
   *  wrapping reached production in the first place. */
  tool_calling_mode?: AdminAiToolCallingMode | null;
  provider_routing?: AdminAiProviderRouting | null;
}

export interface AdminAiUpdateModelData {
  provider_id?: number;
  name?: string;
  model_id?: string;
  input_price_per_1m?: number;
  output_price_per_1m?: number;
  max_context_tokens?: number;
  supports_vision?: boolean;
  supports_streaming?: boolean;
  tool_calling_mode?: AdminAiToolCallingMode | null;
  provider_routing?: AdminAiProviderRouting | null;
}

export interface AdminAiModelsListResponse {
  success: boolean;
  message: string;
  data: AdminAiModel[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminAiModelDetailResponse {
  success: boolean;
  message: string;
  data: AdminAiModel;
}

// ============================================
// AI Agents
// ============================================

export interface AdminAiAgent {
  id: number;
  model_id: number;
  name: string;
  slug: string;
  description: string | null;
  system_prompt?: string | null;
  temperature: string;
  max_response_tokens: number;
  max_iterations: number | null;
  is_active: boolean;
  model?: AdminAiModel;
  conversations_count?: number;
  created_at: string;
  updated_at: string;
}

export type AdminAiAgentDetail = AdminAiAgent;

export interface AdminAiAgentsParams {
  active_only?: boolean;
  model_id?: number;
  sort_by?: 'name' | 'created_at' | 'temperature';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface AdminAiCreateAgentData {
  model_id: number;
  name: string;
  slug: string;
  description?: string;
  system_prompt: string;
  temperature?: number;
  max_response_tokens?: number;
  max_iterations?: number | null;
  is_active?: boolean;
}

export interface AdminAiUpdateAgentData {
  model_id?: number;
  name?: string;
  slug?: string;
  description?: string;
  system_prompt?: string;
  temperature?: number;
  max_response_tokens?: number;
  max_iterations?: number | null;
  is_active?: boolean;
}

export interface AdminAiCopyAgentData {
  name?: string;
  slug?: string;
}

export interface AdminAiAgentsListResponse {
  success: boolean;
  message: string;
  data: AdminAiAgent[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminAiAgentDetailResponse {
  success: boolean;
  message: string;
  data: AdminAiAgentDetail;
}

// ============================================
// AI Tools
// ============================================

export interface AdminAiTool {
  id: number;
  name: string;
  display_name: string;
  description: string;
  category: string | null;
  endpoint_url: string;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  parameters: Record<string, unknown>;
  timeout_seconds: number;
  retry_count: number;
  requires_auth: boolean;
  is_active: boolean;
  agents_count?: number;
  created_at: string;
  updated_at: string;
}

export interface AdminAiToolDetail extends AdminAiTool {
  agents: AdminAiAgent[];
}

export interface AdminAiToolsParams {
  active_only?: boolean;
  category?: string;
  sort_by?: 'name' | 'display_name' | 'category' | 'created_at';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface AdminAiCreateToolData {
  name: string;
  display_name: string;
  description: string;
  category?: string;
  endpoint_url: string;
  http_method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  parameters: Record<string, unknown>;
  timeout_seconds?: number;
  retry_count?: number;
  requires_auth?: boolean;
  is_active?: boolean;
}

export interface AdminAiUpdateToolData {
  name?: string;
  display_name?: string;
  description?: string;
  category?: string;
  endpoint_url?: string;
  http_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  parameters?: Record<string, unknown>;
  timeout_seconds?: number;
  retry_count?: number;
  requires_auth?: boolean;
  is_active?: boolean;
}

export interface AdminAiToolsListResponse {
  success: boolean;
  message: string;
  data: AdminAiTool[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminAiToolDetailResponse {
  success: boolean;
  message: string;
  data: AdminAiToolDetail;
}

// ============================================
// AI Workflows
// ============================================

export type WorkflowExecutionMode = 'simple' | 'react';
export type WorkflowAgentRole = 'primary' | 'specialist' | 'fallback';

export interface AdminAiWorkflowAgent {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  role: WorkflowAgentRole;
  order: number;
  model?: AdminAiModel;
}

export interface AdminAiWorkflowAgentInput {
  agent_id: number;
  role?: WorkflowAgentRole;
  order?: number;
}

export interface AdminAiWorkflow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  execution_mode: WorkflowExecutionMode;
  orchestrator_agent_id: number | null;
  is_default: boolean;
  is_active: boolean;
  agents: AdminAiWorkflowAgent[];
  orchestrator_agent: AdminAiAgent | null;
  conversations_count?: number;
  created_at: string;
  updated_at: string;
}

export type AdminAiWorkflowDetail = AdminAiWorkflow;

export interface AdminAiWorkflowsParams {
  active_only?: boolean;
  sort_by?: 'name' | 'created_at' | 'is_default';
  sort_order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface AdminAiCreateWorkflowData {
  name: string;
  slug: string;
  description?: string;
  execution_mode?: WorkflowExecutionMode;
  orchestrator_agent_id?: number;
  is_default?: boolean;
  is_active?: boolean;
  agents: AdminAiWorkflowAgentInput[];
}

export interface AdminAiUpdateWorkflowData {
  name?: string;
  slug?: string;
  description?: string;
  execution_mode?: WorkflowExecutionMode;
  orchestrator_agent_id?: number;
  is_default?: boolean;
  is_active?: boolean;
  agents?: AdminAiWorkflowAgentInput[];
}

export interface AdminAiCopyWorkflowData {
  deep?: boolean;
  name?: string;
  slug?: string;
}

export interface AdminAiWorkflowsListResponse {
  success: boolean;
  message: string;
  data: AdminAiWorkflow[];
  pagination: AdminConversationsPagination;
  links: AdminConversationsLinks;
}

export interface AdminAiWorkflowDetailResponse {
  success: boolean;
  message: string;
  data: AdminAiWorkflowDetail;
}
