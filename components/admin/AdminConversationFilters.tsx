'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AdminConversationsParams } from '@/types/admin';

interface AdminConversationFiltersProps {
  params: AdminConversationsParams;
  onParamsChange: (params: Partial<AdminConversationsParams>) => void;
}

export function AdminConversationFilters({
  params,
  onParamsChange,
}: AdminConversationFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* User UUID Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by User UUID..."
          value={params.user_uuid || ''}
          onChange={(e) =>
            onParamsChange({ user_uuid: e.target.value || undefined, page: 1 })
          }
          className="pl-9 pr-9"
        />
        {params.user_uuid && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => onParamsChange({ user_uuid: undefined, page: 1 })}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Status Filter */}
      <Select
        value={params.status || 'all'}
        onValueChange={(value) =>
          onParamsChange({
            status: value === 'all' ? undefined : (value as 'active' | 'archived'),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
        </SelectContent>
      </Select>

      {/* Privacy Filter */}
      <Select
        value={
          params.is_private === undefined
            ? 'all'
            : params.is_private
              ? 'private'
              : 'public'
        }
        onValueChange={(value) =>
          onParamsChange({
            is_private: value === 'all' ? undefined : value === 'private',
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Privacy" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Privacy</SelectItem>
          <SelectItem value="private">Private</SelectItem>
          <SelectItem value="public">Public</SelectItem>
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
