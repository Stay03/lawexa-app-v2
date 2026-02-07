'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAdminAiProviders } from '@/lib/hooks/useAdminAi';
import type { AdminAiModelsParams } from '@/types/admin-ai';

interface AiModelFiltersProps {
  params: AdminAiModelsParams;
  onParamsChange: (params: Partial<AdminAiModelsParams>) => void;
}

export function AiModelFilters({
  params,
  onParamsChange,
}: AiModelFiltersProps) {
  const { data: providersData } = useAdminAiProviders({ per_page: 100 });
  const providers = providersData?.data || [];

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Provider Filter */}
      <Select
        value={params.provider_id ? String(params.provider_id) : 'all'}
        onValueChange={(value) =>
          onParamsChange({
            provider_id: value === 'all' ? undefined : Number(value),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Providers</SelectItem>
          {providers.map((provider) => (
            <SelectItem key={provider.id} value={String(provider.id)}>
              {provider.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Vision Filter */}
      <Select
        value={
          params.supports_vision === undefined
            ? 'all'
            : params.supports_vision
              ? 'yes'
              : 'no'
        }
        onValueChange={(value) =>
          onParamsChange({
            supports_vision:
              value === 'all' ? undefined : value === 'yes',
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Vision" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Vision</SelectItem>
          <SelectItem value="yes">Vision</SelectItem>
          <SelectItem value="no">No Vision</SelectItem>
        </SelectContent>
      </Select>

      {/* Streaming Filter */}
      <Select
        value={
          params.supports_streaming === undefined
            ? 'all'
            : params.supports_streaming
              ? 'yes'
              : 'no'
        }
        onValueChange={(value) =>
          onParamsChange({
            supports_streaming:
              value === 'all' ? undefined : value === 'yes',
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Streaming" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Streaming</SelectItem>
          <SelectItem value="yes">Streaming</SelectItem>
          <SelectItem value="no">No Streaming</SelectItem>
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
