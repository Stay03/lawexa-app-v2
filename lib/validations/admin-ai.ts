import { z } from 'zod';

// ============================================
// Shared
// ============================================

const slugRegex = /^[a-z0-9-_]+$/;

const slugField = z
  .string()
  .min(1, 'Slug is required')
  .max(100, 'Slug must be 100 characters or less')
  .regex(slugRegex, 'Slug must contain only lowercase letters, numbers, hyphens, and underscores');

// ============================================
// Provider Schemas
// ============================================

export const createProviderSchema = z.object({
  name: z.string().min(1, 'Provider name is required').max(255),
  slug: slugField,
  base_url: z.string().min(1, 'Base URL is required').url('Base URL must be a valid URL').max(500),
  api_key: z.string().min(1, 'API key is required'),
  is_active: z.boolean().optional(),
});

export const updateProviderSchema = createProviderSchema.partial();

export type CreateProviderFormData = z.infer<typeof createProviderSchema>;
export type UpdateProviderFormData = z.infer<typeof updateProviderSchema>;

// ============================================
// Model Schemas
// ============================================

export const createModelSchema = z.object({
  provider_id: z.number({ message: 'Provider is required' }).int().positive('Provider is required'),
  name: z.string().min(1, 'Model name is required').max(255),
  model_id: z.string().min(1, 'Model ID is required').max(255),
  input_price_per_1m: z.number().min(0, 'Price must be 0 or greater').optional(),
  output_price_per_1m: z.number().min(0, 'Price must be 0 or greater').optional(),
  max_context_tokens: z.number().int().min(1000, 'Minimum context is 1000 tokens').optional(),
  supports_vision: z.boolean().optional(),
  supports_streaming: z.boolean().optional(),
});

export const updateModelSchema = createModelSchema.partial();

export type CreateModelFormData = z.infer<typeof createModelSchema>;
export type UpdateModelFormData = z.infer<typeof updateModelSchema>;

// ============================================
// Agent Schemas
// ============================================

export const createAgentSchema = z.object({
  model_id: z.number({ message: 'AI model is required' }).int().positive('AI model is required'),
  name: z.string().min(1, 'Agent name is required').max(255),
  slug: slugField,
  description: z.string().optional(),
  system_prompt: z.string().min(1, 'System prompt is required'),
  temperature: z
    .number()
    .min(0, 'Temperature must be between 0 and 2')
    .max(2, 'Temperature must be between 0 and 2')
    .optional(),
  max_response_tokens: z
    .number()
    .int()
    .min(100, 'Minimum is 100 tokens')
    .max(32000, 'Maximum is 32000 tokens')
    .optional(),
  is_active: z.boolean().optional(),
});

export const updateAgentSchema = createAgentSchema.partial();

export type CreateAgentFormData = z.infer<typeof createAgentSchema>;
export type UpdateAgentFormData = z.infer<typeof updateAgentSchema>;

// ============================================
// Tool Schemas
// ============================================

const httpMethodEnum = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], {
  message: 'HTTP method must be GET, POST, PUT, PATCH, or DELETE',
});

// Note: parameters is validated as a JSON string in the form.
// The form submission handler must JSON.parse() before sending to the API.
export const createToolSchema = z.object({
  name: z
    .string()
    .min(1, 'Tool name is required')
    .max(100)
    .regex(/^[a-z0-9_]+$/, 'Tool name must contain only lowercase letters, numbers, and underscores'),
  display_name: z.string().min(1, 'Display name is required').max(255),
  description: z.string().min(1, 'Description is required'),
  category: z.string().max(50).optional(),
  endpoint_url: z.string().min(1, 'Endpoint URL is required').max(500),
  http_method: httpMethodEnum,
  parameters: z
    .string()
    .min(1, 'Parameters JSON is required')
    .refine(
      (val) => {
        try {
          const parsed = JSON.parse(val);
          return parsed && typeof parsed === 'object' && parsed.type === 'object';
        } catch {
          return false;
        }
      },
      { message: 'Parameters must be valid JSON with type "object"' }
    ),
  timeout_seconds: z
    .number()
    .int()
    .min(5, 'Minimum timeout is 5 seconds')
    .max(120, 'Maximum timeout is 120 seconds')
    .optional(),
  retry_count: z.number().int().min(0).max(5, 'Maximum retry count is 5').optional(),
  requires_auth: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

export const updateToolSchema = createToolSchema.partial();

export type CreateToolFormData = z.infer<typeof createToolSchema>;
export type UpdateToolFormData = z.infer<typeof updateToolSchema>;

// ============================================
// Workflow Schemas
// ============================================

const workflowAgentSchema = z.object({
  agent_id: z.number().int().positive('Agent ID is required'),
  role: z.enum(['primary', 'specialist', 'fallback']).optional(),
  order: z.number().int().min(0).optional(),
});

export const createWorkflowSchema = z
  .object({
    name: z.string().min(1, 'Workflow name is required').max(255),
    slug: slugField,
    description: z.string().optional(),
    execution_mode: z.enum(['simple', 'react']).optional(),
    orchestrator_agent_id: z.number().int().positive().optional(),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
    agents: z
      .array(workflowAgentSchema)
      .min(1, 'At least one agent must be assigned'),
  })
  .refine(
    (data) => {
      const primaryAgents = data.agents.filter(
        (a) => a.role === 'primary' || a.role === undefined
      );
      return primaryAgents.length === 1;
    },
    {
      message: 'Exactly one agent must have the primary role',
      path: ['agents'],
    }
  );

// Manually written (not .partial()) because refine must be conditional
export const updateWorkflowSchema = z
  .object({
    name: z.string().min(1, 'Workflow name is required').max(255).optional(),
    slug: slugField.optional(),
    description: z.string().optional(),
    execution_mode: z.enum(['simple', 'react']).optional(),
    orchestrator_agent_id: z.number().int().positive().optional(),
    is_default: z.boolean().optional(),
    is_active: z.boolean().optional(),
    agents: z
      .array(workflowAgentSchema)
      .min(1, 'At least one agent must be assigned')
      .optional(),
  })
  .refine(
    (data) => {
      if (!data.agents) return true;
      const primaryAgents = data.agents.filter(
        (a) => a.role === 'primary' || a.role === undefined
      );
      return primaryAgents.length === 1;
    },
    {
      message: 'Exactly one agent must have the primary role',
      path: ['agents'],
    }
  );

export type CreateWorkflowFormData = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflowFormData = z.infer<typeof updateWorkflowSchema>;
