import { apiClient } from './client';
import type {
  AdminAiProvidersParams,
  AdminAiProvidersListResponse,
  AdminAiProviderDetailResponse,
  AdminAiCreateProviderData,
  AdminAiUpdateProviderData,
  AdminAiTestProviderResponse,
  AdminAiMutationResponse,
  AdminAiProvider,
  AdminAiProviderDetail,
  AdminAiModelsParams,
  AdminAiModelsListResponse,
  AdminAiModelDetailResponse,
  AdminAiCreateModelData,
  AdminAiUpdateModelData,
  AdminAiModel,
  AdminAiAgentsParams,
  AdminAiAgentsListResponse,
  AdminAiAgentDetailResponse,
  AdminAiCreateAgentData,
  AdminAiUpdateAgentData,
  AdminAiCopyAgentData,
  AdminAiAgent,
  AdminAiToolsParams,
  AdminAiToolsListResponse,
  AdminAiToolDetailResponse,
  AdminAiCreateToolData,
  AdminAiUpdateToolData,
  AdminAiTool,
  AdminAiToolDetail,
  AdminAiWorkflowsParams,
  AdminAiWorkflowsListResponse,
  AdminAiWorkflowDetailResponse,
  AdminAiCreateWorkflowData,
  AdminAiUpdateWorkflowData,
  AdminAiCopyWorkflowData,
  AdminAiWorkflow,
} from '@/types/admin-ai';

export const adminAiApi = {
  // ============================================
  // Providers
  // ============================================

  /**
   * List all AI providers with pagination, filtering, and sorting
   */
  getProviders: async (
    params: AdminAiProvidersParams = {}
  ): Promise<AdminAiProvidersListResponse> => {
    const response = await apiClient.get<AdminAiProvidersListResponse>(
      '/admin/ai-providers',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          active_only: params.active_only,
          sort_by: params.sort_by ?? 'name',
          sort_order: params.sort_order ?? 'asc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single provider with all its models
   */
  getProvider: async (
    id: number
  ): Promise<AdminAiProviderDetailResponse> => {
    const response = await apiClient.get<AdminAiProviderDetailResponse>(
      `/admin/ai-providers/${id}`
    );
    return response.data;
  },

  /**
   * Create a new AI provider
   */
  createProvider: async (
    data: AdminAiCreateProviderData
  ): Promise<AdminAiMutationResponse<AdminAiProvider>> => {
    const response = await apiClient.post<AdminAiMutationResponse<AdminAiProvider>>(
      '/admin/ai-providers',
      data
    );
    return response.data;
  },

  /**
   * Update an existing provider
   */
  updateProvider: async (
    id: number,
    data: AdminAiUpdateProviderData
  ): Promise<AdminAiMutationResponse<AdminAiProvider>> => {
    const response = await apiClient.put<AdminAiMutationResponse<AdminAiProvider>>(
      `/admin/ai-providers/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a provider (fails if it has models)
   */
  deleteProvider: async (
    id: number
  ): Promise<AdminAiMutationResponse<null>> => {
    const response = await apiClient.delete<AdminAiMutationResponse<null>>(
      `/admin/ai-providers/${id}`
    );
    return response.data;
  },

  /**
   * Test a provider's API key connectivity
   */
  testProvider: async (
    id: number
  ): Promise<AdminAiTestProviderResponse> => {
    const response = await apiClient.post<AdminAiTestProviderResponse>(
      `/admin/ai-providers/${id}/test`
    );
    return response.data;
  },

  // ============================================
  // Models
  // ============================================

  /**
   * List all AI models with pagination, filtering, and sorting
   */
  getModels: async (
    params: AdminAiModelsParams = {}
  ): Promise<AdminAiModelsListResponse> => {
    const response = await apiClient.get<AdminAiModelsListResponse>(
      '/admin/ai-models',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          provider_id: params.provider_id,
          supports_vision: params.supports_vision,
          supports_streaming: params.supports_streaming,
          sort_by: params.sort_by ?? 'name',
          sort_order: params.sort_order ?? 'asc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single model with its provider
   */
  getModel: async (
    id: number
  ): Promise<AdminAiModelDetailResponse> => {
    const response = await apiClient.get<AdminAiModelDetailResponse>(
      `/admin/ai-models/${id}`
    );
    return response.data;
  },

  /**
   * Create a new AI model
   */
  createModel: async (
    data: AdminAiCreateModelData
  ): Promise<AdminAiMutationResponse<AdminAiModel>> => {
    const response = await apiClient.post<AdminAiMutationResponse<AdminAiModel>>(
      '/admin/ai-models',
      data
    );
    return response.data;
  },

  /**
   * Update an existing model
   */
  updateModel: async (
    id: number,
    data: AdminAiUpdateModelData
  ): Promise<AdminAiMutationResponse<AdminAiModel>> => {
    const response = await apiClient.put<AdminAiMutationResponse<AdminAiModel>>(
      `/admin/ai-models/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a model
   */
  deleteModel: async (
    id: number
  ): Promise<AdminAiMutationResponse<null>> => {
    const response = await apiClient.delete<AdminAiMutationResponse<null>>(
      `/admin/ai-models/${id}`
    );
    return response.data;
  },

  // ============================================
  // Agents
  // ============================================

  /**
   * List all AI agents with pagination, filtering, and sorting
   */
  getAgents: async (
    params: AdminAiAgentsParams = {}
  ): Promise<AdminAiAgentsListResponse> => {
    const response = await apiClient.get<AdminAiAgentsListResponse>(
      '/admin/ai-agents',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          active_only: params.active_only,
          model_id: params.model_id,
          sort_by: params.sort_by ?? 'name',
          sort_order: params.sort_order ?? 'asc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single agent with model (including provider)
   */
  getAgent: async (
    id: number
  ): Promise<AdminAiAgentDetailResponse> => {
    const response = await apiClient.get<AdminAiAgentDetailResponse>(
      `/admin/ai-agents/${id}`
    );
    return response.data;
  },

  /**
   * Create a new AI agent
   */
  createAgent: async (
    data: AdminAiCreateAgentData
  ): Promise<AdminAiMutationResponse<AdminAiAgent>> => {
    const response = await apiClient.post<AdminAiMutationResponse<AdminAiAgent>>(
      '/admin/ai-agents',
      data
    );
    return response.data;
  },

  /**
   * Update an existing agent
   */
  updateAgent: async (
    id: number,
    data: AdminAiUpdateAgentData
  ): Promise<AdminAiMutationResponse<AdminAiAgent>> => {
    const response = await apiClient.put<AdminAiMutationResponse<AdminAiAgent>>(
      `/admin/ai-agents/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete an agent (fails if it has conversations)
   */
  deleteAgent: async (
    id: number
  ): Promise<AdminAiMutationResponse<null>> => {
    const response = await apiClient.delete<AdminAiMutationResponse<null>>(
      `/admin/ai-agents/${id}`
    );
    return response.data;
  },

  /**
   * Copy an agent with optional custom name/slug
   */
  copyAgent: async (
    id: number,
    data?: AdminAiCopyAgentData
  ): Promise<AdminAiMutationResponse<AdminAiAgent>> => {
    const response = await apiClient.post<AdminAiMutationResponse<AdminAiAgent>>(
      `/admin/ai-agents/${id}/copy`,
      data ?? {}
    );
    return response.data;
  },

  // ============================================
  // Tools
  // ============================================

  /**
   * List all AI tools with pagination, filtering, and sorting
   */
  getTools: async (
    params: AdminAiToolsParams = {}
  ): Promise<AdminAiToolsListResponse> => {
    const response = await apiClient.get<AdminAiToolsListResponse>(
      '/admin/ai-tools',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          active_only: params.active_only,
          category: params.category,
          sort_by: params.sort_by ?? 'name',
          sort_order: params.sort_order ?? 'asc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single tool with its assigned agents
   */
  getTool: async (
    id: number
  ): Promise<AdminAiToolDetailResponse> => {
    const response = await apiClient.get<AdminAiToolDetailResponse>(
      `/admin/ai-tools/${id}`
    );
    return response.data;
  },

  /**
   * Create a new AI tool
   */
  createTool: async (
    data: AdminAiCreateToolData
  ): Promise<AdminAiMutationResponse<AdminAiTool>> => {
    const response = await apiClient.post<AdminAiMutationResponse<AdminAiTool>>(
      '/admin/ai-tools',
      data
    );
    return response.data;
  },

  /**
   * Update an existing tool
   */
  updateTool: async (
    id: number,
    data: AdminAiUpdateToolData
  ): Promise<AdminAiMutationResponse<AdminAiTool>> => {
    const response = await apiClient.put<AdminAiMutationResponse<AdminAiTool>>(
      `/admin/ai-tools/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a tool (fails if assigned to agents)
   */
  deleteTool: async (
    id: number
  ): Promise<AdminAiMutationResponse<null>> => {
    const response = await apiClient.delete<AdminAiMutationResponse<null>>(
      `/admin/ai-tools/${id}`
    );
    return response.data;
  },

  /**
   * Attach a tool to an agent
   */
  attachToolToAgent: async (
    toolId: number,
    agentId: number
  ): Promise<AdminAiMutationResponse<AdminAiToolDetail>> => {
    const response = await apiClient.post<AdminAiMutationResponse<AdminAiToolDetail>>(
      `/admin/ai-tools/${toolId}/agents/${agentId}`
    );
    return response.data;
  },

  /**
   * Detach a tool from an agent
   */
  detachToolFromAgent: async (
    toolId: number,
    agentId: number
  ): Promise<AdminAiMutationResponse<null>> => {
    const response = await apiClient.delete<AdminAiMutationResponse<null>>(
      `/admin/ai-tools/${toolId}/agents/${agentId}`
    );
    return response.data;
  },

  // ============================================
  // Workflows
  // ============================================

  /**
   * List all AI workflows with pagination, filtering, and sorting
   */
  getWorkflows: async (
    params: AdminAiWorkflowsParams = {}
  ): Promise<AdminAiWorkflowsListResponse> => {
    const response = await apiClient.get<AdminAiWorkflowsListResponse>(
      '/admin/ai-workflows',
      {
        params: {
          page: params.page ?? 1,
          per_page: params.per_page ?? 15,
          active_only: params.active_only,
          sort_by: params.sort_by ?? 'name',
          sort_order: params.sort_order ?? 'asc',
        },
      }
    );
    return response.data;
  },

  /**
   * Get a single workflow with agents, orchestrator, and conversation count
   */
  getWorkflow: async (
    id: number
  ): Promise<AdminAiWorkflowDetailResponse> => {
    const response = await apiClient.get<AdminAiWorkflowDetailResponse>(
      `/admin/ai-workflows/${id}`
    );
    return response.data;
  },

  /**
   * Create a new workflow with agent assignments
   */
  createWorkflow: async (
    data: AdminAiCreateWorkflowData
  ): Promise<AdminAiMutationResponse<AdminAiWorkflow>> => {
    const response = await apiClient.post<AdminAiMutationResponse<AdminAiWorkflow>>(
      '/admin/ai-workflows',
      data
    );
    return response.data;
  },

  /**
   * Update an existing workflow
   */
  updateWorkflow: async (
    id: number,
    data: AdminAiUpdateWorkflowData
  ): Promise<AdminAiMutationResponse<AdminAiWorkflow>> => {
    const response = await apiClient.put<AdminAiMutationResponse<AdminAiWorkflow>>(
      `/admin/ai-workflows/${id}`,
      data
    );
    return response.data;
  },

  /**
   * Delete a workflow (fails if it has conversations or is default)
   */
  deleteWorkflow: async (
    id: number
  ): Promise<AdminAiMutationResponse<null>> => {
    const response = await apiClient.delete<AdminAiMutationResponse<null>>(
      `/admin/ai-workflows/${id}`
    );
    return response.data;
  },

  /**
   * Copy a workflow with optional deep copy, custom name/slug
   */
  copyWorkflow: async (
    id: number,
    data?: AdminAiCopyWorkflowData
  ): Promise<AdminAiMutationResponse<AdminAiWorkflow>> => {
    const response = await apiClient.post<AdminAiMutationResponse<AdminAiWorkflow>>(
      `/admin/ai-workflows/${id}/copy`,
      data ?? {}
    );
    return response.data;
  },
};
