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
import type { AdminSubscribersParams } from '@/types/admin';

/******************************************************************************
                                 Types
******************************************************************************/

interface AdminSubscriberFiltersProps {
  params: AdminSubscribersParams;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onParamsChange: (params: Partial<AdminSubscribersParams>) => void;
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Filters for the admin subscribers list.
 */
function AdminSubscriberFilters({
  params,
  searchValue,
  onSearchChange,
  onParamsChange,
}: AdminSubscriberFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search by name or email */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchValue && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
            onClick={() => onSearchChange('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Role Filter */}
      <Select
        value={params.role || 'all'}
        onValueChange={(v) =>
          onParamsChange({
            role: v === 'all' ? undefined : (v as AdminSubscribersParams['role']),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          <SelectItem value="user">User</SelectItem>
          <SelectItem value="researcher">Researcher</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="superadmin">Superadmin</SelectItem>
          <SelectItem value="guest">Guest</SelectItem>
        </SelectContent>
      </Select>

      {/* Subscription Status Filter */}
      <Select
        value={params.subscription_status || 'all'}
        onValueChange={(v) =>
          onParamsChange({
            subscription_status: v === 'all' ? undefined : (v as AdminSubscribersParams['subscription_status']),
            page: 1,
          })
        }
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Sub. Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="past_due">Past Due</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
          <SelectItem value="trialing">Trialing</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export { AdminSubscriberFilters };
