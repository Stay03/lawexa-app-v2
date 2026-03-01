import {
  Globe,
  Calendar,
  CircleDot,
  BookOpen,
  User,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CaseMetadataItem } from '@/components/cases';
import type { Country } from '@/types/case';
import type { StatuteCreator } from '@/types/statute';

interface StatuteMetadataGridProps {
  country: Country | null;
  year: number;
  statusLabel: string;
  commencementDate: string | null;
  creator: StatuteCreator | null;
  nodesCount: number;
  className?: string;
  animationStartDelay?: number;
}

/**
 * Responsive grid displaying statute metadata items
 */
function StatuteMetadataGrid({
  country,
  year,
  statusLabel,
  commencementDate,
  creator,
  nodesCount,
  className,
  animationStartDelay = 400,
}: StatuteMetadataGridProps) {
  const items: Array<{
    key: string;
    icon: typeof Globe;
    label: string;
    value: React.ReactNode;
  }> = [];

  if (country) {
    items.push({
      key: 'country',
      icon: Globe,
      label: 'Jurisdiction',
      value: (
        <div>
          <div>{country.name}</div>
          {country.code && (
            <div className="text-xs text-muted-foreground">{country.code}</div>
          )}
        </div>
      ),
    });
  }

  items.push({
    key: 'year',
    icon: Calendar,
    label: 'Year of Enactment',
    value: String(year),
  });

  items.push({
    key: 'status',
    icon: CircleDot,
    label: 'Status',
    value: statusLabel,
  });

  if (commencementDate) {
    const formatted = new Date(commencementDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    items.push({
      key: 'commencement',
      icon: BookOpen,
      label: 'Commencement Date',
      value: formatted,
    });
  }

  if (creator) {
    items.push({
      key: 'creator',
      icon: User,
      label: 'Added By',
      value: creator.name,
    });
  }

  if (nodesCount > 0) {
    items.push({
      key: 'sections',
      icon: Hash,
      label: 'Total Sections',
      value: String(nodesCount),
    });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3',
        className
      )}
    >
      {items.map((item, index) => (
        <CaseMetadataItem
          key={item.key}
          icon={item.icon}
          label={item.label}
          value={item.value}
          animationDelay={animationStartDelay + index * 50}
        />
      ))}
    </div>
  );
}

export { StatuteMetadataGrid };
