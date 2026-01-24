import type { ToolMessage } from '@/types/chat';

export interface ToolDisplayData {
  parameters: Array<{ label: string; value: string }>;
  resultSummary: string | null;
  itemCount: number | null;
  success: boolean;
  error: string | null;
}

/**
 * Get a human-readable label for a tool parameter
 */
function getParameterLabel(key: string): string {
  const labels: Record<string, string> = {
    query: 'Query',
    limit: 'Limit',
    case_id: 'Case ID',
    note_id: 'Note ID',
    page: 'Page',
    per_page: 'Per Page',
    sort_by: 'Sort By',
    sort_order: 'Sort Order',
    status: 'Status',
    category: 'Category',
  };

  return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract displayable data from a tool message for the expanded view
 */
export function extractToolDisplayData(message: ToolMessage): ToolDisplayData {
  const params: Array<{ label: string; value: string }> = [];

  const { toolParameters, toolResult } = message;

  // Extract common parameters
  const paramKeys = ['query', 'limit', 'case_id', 'note_id', 'page', 'per_page', 'sort_by', 'sort_order', 'status', 'category'];

  for (const key of paramKeys) {
    if (toolParameters[key] !== undefined && toolParameters[key] !== null) {
      params.push({
        label: getParameterLabel(key),
        value: String(toolParameters[key]),
      });
    }
  }

  // Also add any other parameters not in the predefined list
  for (const [key, value] of Object.entries(toolParameters)) {
    if (!paramKeys.includes(key) && value !== undefined && value !== null) {
      params.push({
        label: getParameterLabel(key),
        value: String(value),
      });
    }
  }

  // Extract result count from nested data structure
  let itemCount: number | null = null;
  let resultSummary: string | null = null;
  let resourceType: string | null = null;

  if (toolResult?.data && typeof toolResult.data === 'object') {
    const data = toolResult.data as Record<string, unknown>;

    // Handle nested data structure: { success, message, data: { lawyers: [], returned: 2 } }
    if (data.data && typeof data.data === 'object') {
      const innerData = data.data as Record<string, unknown>;

      // Check for 'returned' count first
      if (typeof innerData.returned === 'number') {
        itemCount = innerData.returned;
      }

      // Check for array lengths and determine resource type
      const arrayKeys = ['lawyers', 'cases', 'notes', 'results', 'items'];
      for (const key of arrayKeys) {
        if (Array.isArray(innerData[key])) {
          const count = (innerData[key] as unknown[]).length;
          // Use returned count if available, otherwise use array length
          if (itemCount === null) {
            itemCount = count;
          }
          resourceType = key;
          break;
        }
      }
    }

    // Also check for direct arrays at data level (some APIs return { data: [...] })
    if (itemCount === null) {
      const arrayKeys = ['lawyers', 'cases', 'notes', 'results', 'items'];
      for (const key of arrayKeys) {
        if (Array.isArray(data[key])) {
          itemCount = (data[key] as unknown[]).length;
          resourceType = key;
          break;
        }
      }
    }

    // Use message from response if available
    if (typeof data.message === 'string') {
      resultSummary = data.message;
    }
  }

  // Determine resource type from tool name - this takes priority over array keys
  // because API responses might have unexpected array names
  if (message.toolName.includes('case')) {
    resourceType = 'case';
  } else if (message.toolName.includes('note')) {
    resourceType = 'note';
  } else if (message.toolName.includes('lawyer')) {
    resourceType = 'lawyer';
  }

  // Generate result summary with count if we have one
  if (itemCount !== null) {
    // Singularize the resource type if it ends with 's' (e.g., 'lawyers' -> 'lawyer')
    let typeLabel = resourceType || 'result';
    if (typeLabel.endsWith('s')) {
      typeLabel = typeLabel.slice(0, -1);
    }
    const plural = itemCount !== 1 ? 's' : '';
    resultSummary = `${itemCount} ${typeLabel}${plural} found`;
  }

  return {
    parameters: params,
    resultSummary,
    itemCount,
    success: toolResult?.success ?? false,
    error: toolResult?.error ?? null,
  };
}
