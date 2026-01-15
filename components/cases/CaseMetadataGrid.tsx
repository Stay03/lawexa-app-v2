import {
  Scale,
  Globe,
  FileText,
  BookMarked,
  GraduationCap,
  Gavel,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CaseMetadataItem } from './CaseMetadataItem';
import type { Court, Country } from '@/types/case';

interface CaseMetadataGridProps {
  court: Court | null;
  country: Country | null;
  citation: string | null;
  topic: string | null;
  course: string | null;
  judicialPrecedent: string | null;
  className?: string;
  animationStartDelay?: number;
}

/**
 * Helper to safely render a value - handles objects by extracting name property
 */
function safeStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'name' in value) {
    return String((value as { name: unknown }).name);
  }
  return null;
}

/**
 * Responsive grid displaying all case metadata items
 */
function CaseMetadataGrid({
  court,
  country,
  citation,
  topic,
  course,
  judicialPrecedent,
  className,
  animationStartDelay = 400,
}: CaseMetadataGridProps) {
  // Build list of metadata items to render (only non-null values)
  const items: Array<{
    key: string;
    icon: typeof Scale;
    label: string;
    value: React.ReactNode;
  }> = [];

  if (court && typeof court === 'object' && court.name) {
    items.push({
      key: 'court',
      icon: Scale,
      label: 'Court',
      value: (
        <div>
          <div>{String(court.name)}</div>
          {court.abbreviation && (
            <div className="text-xs text-muted-foreground">
              {String(court.abbreviation)}
            </div>
          )}
        </div>
      ),
    });
  }

  if (country && typeof country === 'object' && country.name) {
    items.push({
      key: 'country',
      icon: Globe,
      label: 'Country',
      value: (
        <div>
          <div>{String(country.name)}</div>
          {country.code && (
            <div className="text-xs text-muted-foreground">
              {String(country.code)}
            </div>
          )}
        </div>
      ),
    });
  }

  const safeCitation = safeStringValue(citation);
  if (safeCitation) {
    items.push({
      key: 'citation',
      icon: FileText,
      label: 'Citation',
      value: safeCitation,
    });
  }

  const safeTopic = safeStringValue(topic);
  if (safeTopic) {
    items.push({
      key: 'topic',
      icon: BookMarked,
      label: 'Topic',
      value: safeTopic,
    });
  }

  const safeCourse = safeStringValue(course);
  if (safeCourse) {
    items.push({
      key: 'course',
      icon: GraduationCap,
      label: 'Course',
      value: safeCourse,
    });
  }

  const safePrecedent = safeStringValue(judicialPrecedent);
  if (safePrecedent) {
    items.push({
      key: 'precedent',
      icon: Gavel,
      label: 'Judicial Precedent',
      value: safePrecedent,
    });
  }

  // Don't render if no items
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

export { CaseMetadataGrid };
