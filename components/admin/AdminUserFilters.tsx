'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
import type { IAdminUserListParams } from '@/types/admin';

/******************************************************************************
                                 Constants
******************************************************************************/

const ROLE_OPTIONS = [
  { value: 'superadmin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'user', label: 'User' },
  { value: 'guest', label: 'Guest' },
  { value: 'bot', label: 'Bot' },
] as const;

/******************************************************************************
                                 Types
******************************************************************************/

interface IAdminUserFiltersProps {
  params: IAdminUserListParams;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onParamsChange: (params: Partial<IAdminUserListParams>) => void;
}

interface ISheetFilterState {
  auth_provider: string[];
  subscription_plan: string[];
  has_payg_balance: boolean | undefined;
  is_creator: boolean | undefined;
  is_verified: boolean | undefined;
  profession: string[];
  country: string[];
  created_from: string;
  created_to: string;
  utm_source: string[];
  utm_medium: string[];
  utm_campaign: string[];
}

/******************************************************************************
                                 Component
******************************************************************************/

/**
 * Default component. Filter controls for the admin users list.
 */
function AdminUserFilters({
  params,
  searchValue,
  onSearchChange,
  onParamsChange,
}: IAdminUserFiltersProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Count active advanced filters (for the badge on "More Filters" button)
  const advancedFilterCount = useMemo(() => {
    let count = 0;
    if (params.auth_provider?.length) count++;
    if (params.subscription_plan?.length) count++;
    if (params.has_payg_balance !== undefined) count++;
    if (params.is_creator !== undefined) count++;
    if (params.is_verified !== undefined) count++;
    if (params.profession?.length) count++;
    if (params.country?.length) count++;
    if (params.created_from) count++;
    if (params.created_to) count++;
    if (params.utm_source?.length) count++;
    if (params.utm_medium?.length) count++;
    if (params.utm_campaign?.length) count++;
    return count;
  }, [params]);

  // Check if any filter is active (for "Clear All" visibility)
  const hasActiveFilters = useMemo(() => {
    return !!(
      searchValue ||
      params.role?.length ||
      params.is_online !== undefined ||
      params.referred_by ||
      advancedFilterCount > 0
    );
  }, [
    searchValue,
    params.role,
    params.is_online,
    params.referred_by,
    advancedFilterCount,
  ]);

  // Clear all filters
  const handleClearAll = () => {
    onSearchChange('');
    onParamsChange({
      role: undefined,
      auth_provider: undefined,
      is_online: undefined,
      profession: undefined,
      country: undefined,
      subscription_plan: undefined,
      has_payg_balance: undefined,
      is_creator: undefined,
      is_verified: undefined,
      created_from: undefined,
      created_to: undefined,
      utm_source: undefined,
      utm_medium: undefined,
      utm_campaign: undefined,
      referred_by: undefined,
      search: undefined,
      page: 1,
    });
  };

  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-3">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
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

      {/* Role Multi-Select */}
      <RoleMultiSelect
        value={params.role || []}
        onChange={(roles) =>
          onParamsChange({
            role: roles.length > 0 ? roles : undefined,
            page: 1,
          })
        }
      />

      {/* Online Only Toggle */}
      <label className="flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-background cursor-pointer select-none">
        <Switch
          checked={params.is_online === true}
          onCheckedChange={(checked) =>
            onParamsChange({
              is_online: checked ? true : undefined,
              page: 1,
            })
          }
          className="scale-90"
        />
        <span className="text-sm whitespace-nowrap">Online only</span>
      </label>

      {/* More Filters Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            More Filters
            {advancedFilterCount > 0 && (
              <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                {advancedFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[380px] sm:w-[420px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>More Filters</SheetTitle>
          </SheetHeader>
          <MoreFiltersContent
            params={params}
            onApply={(updates) => {
              onParamsChange({ ...updates, page: 1 });
              setIsSheetOpen(false);
            }}
            onClear={() => {
              onParamsChange({
                auth_provider: undefined,
                subscription_plan: undefined,
                has_payg_balance: undefined,
                is_creator: undefined,
                is_verified: undefined,
                profession: undefined,
                country: undefined,
                created_from: undefined,
                created_to: undefined,
                utm_source: undefined,
                utm_medium: undefined,
                utm_campaign: undefined,
                page: 1,
              });
              setIsSheetOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Clear All */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleClearAll}>
          <X className="mr-1 h-4 w-4" />
          Clear All
        </Button>
      )}
    </div>
  );
}

/******************************************************************************
                                 Sub-components
******************************************************************************/

/**
 * Multi-select popover for roles.
 */
function RoleMultiSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const handleToggle = (role: string) => {
    if (value.includes(role)) {
      onChange(value.filter((r) => r !== role));
    } else {
      onChange([...value, role]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[130px] justify-between">
          <span className="truncate">
            {value.length > 0 ? `Role (${value.length})` : 'Role'}
          </span>
          <ChevronDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[180px] p-2 gap-0">
        {ROLE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
          >
            <Checkbox
              checked={value.includes(option.value)}
              onCheckedChange={() => handleToggle(option.value)}
            />
            {option.label}
          </label>
        ))}
        {value.length > 0 && (
          <>
            <div className="border-t my-1" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full h-7 text-xs text-muted-foreground"
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Sheet content for advanced filters.
 */
function MoreFiltersContent({
  params,
  onApply,
  onClear,
}: {
  params: IAdminUserListParams;
  onApply: (updates: Partial<IAdminUserListParams>) => void;
  onClear: () => void;
}) {
  // Local state for batch editing
  const [local, setLocal] = useState<ISheetFilterState>({
    auth_provider: params.auth_provider || [],
    subscription_plan: params.subscription_plan || [],
    has_payg_balance: params.has_payg_balance,
    is_creator: params.is_creator,
    is_verified: params.is_verified,
    profession: params.profession || [],
    country: params.country || [],
    created_from: params.created_from || '',
    created_to: params.created_to || '',
    utm_source: params.utm_source || [],
    utm_medium: params.utm_medium || [],
    utm_campaign: params.utm_campaign || [],
  });

  const handleApply = () => {
    onApply({
      auth_provider: local.auth_provider.length > 0 ? local.auth_provider : undefined,
      subscription_plan: local.subscription_plan.length > 0 ? local.subscription_plan : undefined,
      has_payg_balance: local.has_payg_balance,
      is_creator: local.is_creator,
      is_verified: local.is_verified,
      profession: local.profession.length > 0 ? local.profession : undefined,
      country: local.country.length > 0 ? local.country : undefined,
      created_from: local.created_from || undefined,
      created_to: local.created_to || undefined,
      utm_source: local.utm_source.length > 0 ? local.utm_source : undefined,
      utm_medium: local.utm_medium.length > 0 ? local.utm_medium : undefined,
      utm_campaign: local.utm_campaign.length > 0 ? local.utm_campaign : undefined,
    });
  };

  return (
    <div className="flex flex-col gap-5 mt-6">
      {/* Auth Provider */}
      <div className="space-y-2">
        <Label>Auth Provider</Label>
        <Select
          value={local.auth_provider.length === 1 ? local.auth_provider[0] : 'all'}
          onValueChange={(v) =>
            setLocal((s) => ({
              ...s,
              auth_provider: v === 'all' ? [] : [v],
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="google">Google</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Subscription Plan */}
      <div className="space-y-2">
        <Label>Subscription Plan</Label>
        <Input
          placeholder="e.g. pro-monthly"
          value={local.subscription_plan.length > 0 ? local.subscription_plan[0] : ''}
          onChange={(e) =>
            setLocal((s) => ({
              ...s,
              subscription_plan: e.target.value ? [e.target.value] : [],
            }))
          }
        />
      </div>

      {/* Profession */}
      <div className="space-y-2">
        <Label>Profession</Label>
        <Input
          placeholder="e.g. Lawyer"
          value={local.profession.length > 0 ? local.profession[0] : ''}
          onChange={(e) =>
            setLocal((s) => ({
              ...s,
              profession: e.target.value ? [e.target.value] : [],
            }))
          }
        />
      </div>

      {/* Country */}
      <div className="space-y-2">
        <Label>Country</Label>
        <Input
          placeholder="e.g. Nigeria"
          value={local.country.length > 0 ? local.country[0] : ''}
          onChange={(e) =>
            setLocal((s) => ({
              ...s,
              country: e.target.value ? [e.target.value] : [],
            }))
          }
        />
      </div>

      {/* Boolean Filters */}
      <div className="grid grid-cols-1 gap-4">
        <BooleanFilter
          label="Has PAYG Balance"
          value={local.has_payg_balance}
          onChange={(v) => setLocal((s) => ({ ...s, has_payg_balance: v }))}
        />
        <BooleanFilter
          label="Is Creator"
          value={local.is_creator}
          onChange={(v) => setLocal((s) => ({ ...s, is_creator: v }))}
        />
        <BooleanFilter
          label="Is Verified"
          value={local.is_verified}
          onChange={(v) => setLocal((s) => ({ ...s, is_verified: v }))}
        />
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label>Joined Date Range</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={local.created_from}
            onChange={(e) =>
              setLocal((s) => ({ ...s, created_from: e.target.value }))
            }
            placeholder="From"
          />
          <Input
            type="date"
            value={local.created_to}
            onChange={(e) =>
              setLocal((s) => ({ ...s, created_to: e.target.value }))
            }
            placeholder="To"
          />
        </div>
      </div>

      {/* UTM Filters (comma-separated) */}
      <div className="space-y-4 pt-2 border-t">
        <div>
          <p className="text-sm font-medium">Attribution (UTM)</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comma-separate multiple values (e.g. <span className="font-mono">google, caseapp</span>)
          </p>
        </div>
        <div className="space-y-2">
          <Label>UTM Source</Label>
          <Input
            placeholder="e.g. google, caseapp"
            value={local.utm_source.join(', ')}
            onChange={(e) =>
              setLocal((s) => ({ ...s, utm_source: _splitCsv(e.target.value) }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>UTM Medium</Label>
          <Input
            placeholder="e.g. cpc, email"
            value={local.utm_medium.join(', ')}
            onChange={(e) =>
              setLocal((s) => ({ ...s, utm_medium: _splitCsv(e.target.value) }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>UTM Campaign</Label>
          <Input
            placeholder="e.g. q2-launch"
            value={local.utm_campaign.join(', ')}
            onChange={(e) =>
              setLocal((s) => ({ ...s, utm_campaign: _splitCsv(e.target.value) }))
            }
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button variant="outline" className="flex-1" onClick={onClear}>
          Clear Filters
        </Button>
        <Button className="flex-1" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>
  );
}

/**
 * Boolean filter dropdown (All / Yes / No).
 */
function BooleanFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value === undefined ? 'all' : value ? 'yes' : 'no'}
        onValueChange={(v) =>
          onChange(v === 'all' ? undefined : v === 'yes')
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="yes">Yes</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/******************************************************************************
                                 Functions
******************************************************************************/

/**
 * Parse a comma-separated string into a trimmed, non-empty string array.
 */
function _splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/******************************************************************************
                                 Export default
******************************************************************************/

export { AdminUserFilters };
