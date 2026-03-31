'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminAiApi } from '@/lib/api/admin-ai';
import type {
  AdminAiProvidersParams,
  AdminAiCreateProviderData,
  AdminAiUpdateProviderData,
  AdminAiModelsParams,
  AdminAiCreateModelData,
  AdminAiUpdateModelData,
  AdminAiAgentsParams,
  AdminAiCreateAgentData,
  AdminAiUpdateAgentData,
  AdminAiCopyAgentData,
  AdminAiToolsParams,
  AdminAiCreateToolData,
  AdminAiUpdateToolData,
  AdminAiWorkflowsParams,
  AdminAiCreateWorkflowData,
  AdminAiUpdateWorkflowData,
  AdminAiCopyWorkflowData,
} from '@/types/admin-ai';

// ============================================
// Query Key Factory
// ============================================

export const adminAiKeys = {
  all: ['admin', 'ai'] as const,

  // Providers
  providers: () => [...adminAiKeys.all, 'providers'] as const,
  providersList: (params: AdminAiProvidersParams) =>
    [...adminAiKeys.providers(), 'list', params] as const,
  providerDetail: (id: number) =>
    [...adminAiKeys.providers(), 'detail', id] as const,

  // Models
  models: () => [...adminAiKeys.all, 'models'] as const,
  modelsList: (params: AdminAiModelsParams) =>
    [...adminAiKeys.models(), 'list', params] as const,
  modelDetail: (id: number) =>
    [...adminAiKeys.models(), 'detail', id] as const,

  // Agents
  agents: () => [...adminAiKeys.all, 'agents'] as const,
  agentsList: (params: AdminAiAgentsParams) =>
    [...adminAiKeys.agents(), 'list', params] as const,
  agentDetail: (id: number) =>
    [...adminAiKeys.agents(), 'detail', id] as const,

  // Tools
  tools: () => [...adminAiKeys.all, 'tools'] as const,
  toolsList: (params: AdminAiToolsParams) =>
    [...adminAiKeys.tools(), 'list', params] as const,
  toolDetail: (id: number) =>
    [...adminAiKeys.tools(), 'detail', id] as const,

  // Workflows
  workflows: () => [...adminAiKeys.all, 'workflows'] as const,
  workflowsList: (params: AdminAiWorkflowsParams) =>
    [...adminAiKeys.workflows(), 'list', params] as const,
  workflowDetail: (id: number) =>
    [...adminAiKeys.workflows(), 'detail', id] as const,
};

// ============================================
// Provider Hooks
// ============================================

/**
 * Hook for fetching AI providers list with pagination, filtering, sorting
 */
export function useAdminAiProviders(params: AdminAiProvidersParams = {}) {
  return useQuery({
    queryKey: adminAiKeys.providersList(params),
    queryFn: () => adminAiApi.getProviders(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching a single AI provider with its models
 */
export function useAdminAiProvider(id: number) {
  return useQuery({
    queryKey: adminAiKeys.providerDetail(id),
    queryFn: () => adminAiApi.getProvider(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for creating an AI provider
 */
export function useCreateAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminAiCreateProviderData) =>
      adminAiApi.createProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.providers() });
    },
  });
}

/**
 * Hook for updating an AI provider
 */
export function useUpdateAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminAiUpdateProviderData }) =>
      adminAiApi.updateProvider(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.providers() });
      queryClient.invalidateQueries({
        queryKey: adminAiKeys.providerDetail(variables.id),
      });
    },
  });
}

/**
 * Hook for deleting an AI provider
 */
export function useDeleteAiProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminAiApi.deleteProvider(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.providers() });
    },
  });
}

/**
 * Hook for testing an AI provider's API key
 */
export function useTestAiProvider() {
  return useMutation({
    mutationFn: (id: number) => adminAiApi.testProvider(id),
  });
}

// ============================================
// Model Hooks
// ============================================

/**
 * Hook for fetching AI models list with pagination, filtering, sorting
 */
export function useAdminAiModels(params: AdminAiModelsParams = {}) {
  return useQuery({
    queryKey: adminAiKeys.modelsList(params),
    queryFn: () => adminAiApi.getModels(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching a single AI model with its provider
 */
export function useAdminAiModel(id: number) {
  return useQuery({
    queryKey: adminAiKeys.modelDetail(id),
    queryFn: () => adminAiApi.getModel(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for creating an AI model
 */
export function useCreateAiModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminAiCreateModelData) =>
      adminAiApi.createModel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.models() });
    },
  });
}

/**
 * Hook for updating an AI model
 */
export function useUpdateAiModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminAiUpdateModelData }) =>
      adminAiApi.updateModel(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.models() });
      queryClient.invalidateQueries({
        queryKey: adminAiKeys.modelDetail(variables.id),
      });
    },
  });
}

/**
 * Hook for deleting an AI model
 */
export function useDeleteAiModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminAiApi.deleteModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.models() });
    },
  });
}

// ============================================
// Agent Hooks
// ============================================

/**
 * Hook for fetching AI agents list with pagination, filtering, sorting
 */
export function useAdminAiAgents(params: AdminAiAgentsParams = {}) {
  return useQuery({
    queryKey: adminAiKeys.agentsList(params),
    queryFn: () => adminAiApi.getAgents(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching a single AI agent with model and provider
 */
export function useAdminAiAgent(id: number) {
  return useQuery({
    queryKey: adminAiKeys.agentDetail(id),
    queryFn: () => adminAiApi.getAgent(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for creating an AI agent
 */
export function useCreateAiAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminAiCreateAgentData) =>
      adminAiApi.createAgent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.agents() });
    },
  });
}

/**
 * Hook for updating an AI agent
 */
export function useUpdateAiAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminAiUpdateAgentData }) =>
      adminAiApi.updateAgent(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.agents() });
      queryClient.invalidateQueries({
        queryKey: adminAiKeys.agentDetail(variables.id),
      });
    },
  });
}

/**
 * Hook for deleting an AI agent
 */
export function useDeleteAiAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminAiApi.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.agents() });
    },
  });
}

/**
 * Hook for copying an AI agent
 */
export function useCopyAiAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data?: AdminAiCopyAgentData }) =>
      adminAiApi.copyAgent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.agents() });
    },
  });
}

// ============================================
// Tool Hooks
// ============================================

/**
 * Hook for fetching AI tools list with pagination, filtering, sorting
 */
export function useAdminAiTools(params: AdminAiToolsParams = {}) {
  return useQuery({
    queryKey: adminAiKeys.toolsList(params),
    queryFn: () => adminAiApi.getTools(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching a single AI tool with its assigned agents
 */
export function useAdminAiTool(id: number) {
  return useQuery({
    queryKey: adminAiKeys.toolDetail(id),
    queryFn: () => adminAiApi.getTool(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for creating an AI tool
 */
export function useCreateAiTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminAiCreateToolData) =>
      adminAiApi.createTool(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.tools() });
    },
  });
}

/**
 * Hook for updating an AI tool
 */
export function useUpdateAiTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminAiUpdateToolData }) =>
      adminAiApi.updateTool(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.tools() });
      queryClient.invalidateQueries({
        queryKey: adminAiKeys.toolDetail(variables.id),
      });
    },
  });
}

/**
 * Hook for deleting an AI tool
 */
export function useDeleteAiTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminAiApi.deleteTool(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.tools() });
    },
  });
}

/**
 * Hook for attaching a tool to an agent
 */
export function useAttachToolToAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toolId, agentId }: { toolId: number; agentId: number }) =>
      adminAiApi.attachToolToAgent(toolId, agentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.tools() });
      queryClient.invalidateQueries({
        queryKey: adminAiKeys.toolDetail(variables.toolId),
      });
      queryClient.invalidateQueries({
        queryKey: adminAiKeys.agentDetail(variables.agentId),
      });
    },
  });
}

/**
 * Hook for detaching a tool from an agent
 */
export function useDetachToolFromAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ toolId, agentId }: { toolId: number; agentId: number }) =>
      adminAiApi.detachToolFromAgent(toolId, agentId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.tools() });
      queryClient.invalidateQueries({
        queryKey: adminAiKeys.toolDetail(variables.toolId),
      });
      queryClient.invalidateQueries({
        queryKey: adminAiKeys.agentDetail(variables.agentId),
      });
    },
  });
}

// ============================================
// Workflow Hooks
// ============================================

/**
 * Hook for fetching AI workflows list with pagination, filtering, sorting
 */
export function useAdminAiWorkflows(params: AdminAiWorkflowsParams = {}) {
  return useQuery({
    queryKey: adminAiKeys.workflowsList(params),
    queryFn: () => adminAiApi.getWorkflows(params),
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for fetching a single AI workflow with agents and orchestrator
 */
export function useAdminAiWorkflow(id: number) {
  return useQuery({
    queryKey: adminAiKeys.workflowDetail(id),
    queryFn: () => adminAiApi.getWorkflow(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook for creating an AI workflow
 */
export function useCreateAiWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AdminAiCreateWorkflowData) =>
      adminAiApi.createWorkflow(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.workflows() });
    },
  });
}

/**
 * Hook for updating an AI workflow
 */
export function useUpdateAiWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: AdminAiUpdateWorkflowData }) =>
      adminAiApi.updateWorkflow(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.workflows() });
      queryClient.invalidateQueries({
        queryKey: adminAiKeys.workflowDetail(variables.id),
      });
    },
  });
}

/**
 * Hook for deleting an AI workflow
 */
export function useDeleteAiWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminAiApi.deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.workflows() });
    },
  });
}

/**
 * Hook for copying an AI workflow
 */
export function useCopyAiWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data?: AdminAiCopyWorkflowData }) =>
      adminAiApi.copyWorkflow(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminAiKeys.workflows() });
    },
  });
}
