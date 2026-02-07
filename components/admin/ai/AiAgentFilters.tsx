'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminAiModels } from '@/lib/hooks/useAdminAi';
import type { AdminAiAgentsParams } from '@/types/admin-ai';

interface AiAgentFiltersProps {
  params: AdminAiAgentsParams;
  onParamsChange: (params: Partial<AdminAiAgentsParams>) => void;
}

export function AiAgentFilters({
  params,
  onParamsChange,
}: AiAgentFiltersProps) {
  const { data: modelsData } = useAdminAiModels({ per_page: 100 });
  const models = modelsData?.data || [];

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Model Filter */}
      <Select
        value={params.model_id ? String(params.model_id) : 'all'}
        onValueChange={(value) =>
          onParamsChange({
            model_id: value === 'all' ? undefined : Number(value),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Models</SelectItem>
          {models.map((model) => (
            <SelectItem key={model.id} value={String(model.id)}>
              {model.name}
              {model.provider ? ` (${model.provider.name})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active Filter */}
      <Select
        value={
          params.active_only === undefined
            ? 'all'
            : params.active_only
              ? 'active'
              : 'inactive'
        }
        onValueChange={(value) =>
          onParamsChange({
            active_only:
              value === 'all' ? undefined : value === 'active',
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>

      {/* Per Page Selector */}
      <Select
        value={String(params.per_page || 15)}
        onValueChange={(value) =>
          onParamsChange({ per_page: parseInt(value), page: 1 })
        }
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10 / page</SelectItem>
          <SelectItem value="15">15 / page</SelectItem>
          <SelectItem value="25">25 / page</SelectItem>
          <SelectItem value="50">50 / page</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
