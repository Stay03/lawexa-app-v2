import {
  Scale,
  Globe,
  BookMarked,
  GraduationCap,
  CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CaseMetadataItem } from './CaseMetadataItem';
import type { Court, Country } from '@/types/case';

interface CaseMetadataGridProps {
  court: Court | null;
  country: Country | null;
  topic: string | null;
  course: string | null;
  /**
   * The day the reporter issued the report, which is NOT the day the court
   * gave judgment. It belongs here rather than beside the judgment date in
   * the header: the two are months apart on some reports (Garkuwa, 27 January
   * against 21 August 2023) and a reader who sees them side by side reads the
   * later one as the decision. Absent on every case until the provider's
   * published date is stored.
   */
  reportPublishedDate?: string | null;
  className?: string;
  animationStartDelay?: number;
}

/**
 * Helper to safely render a value - handles objects by extracting name property
 */
/**
 * A date for a reader, or nothing at all.
 *
 * Returns null rather than "Invalid Date" when the string will not parse, so a
 * bad value from the reporter drops the row instead of printing nonsense in it.
 */
function formatDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

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
  topic,
  course,
  reportPublishedDate,
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

  const safeTopic = safeStringValue(topic);
  if (safeTopic) {
    items.push({
      key: 'topic',
      icon: BookMarked,
      label: 'Topic',
      value: safeTopic,
    });
  }

  const publishedOn = formatDay(reportPublishedDate);
  if (publishedOn) {
    items.push({
      key: 'reportPublished',
      icon: CalendarClock,
      label: 'Report published',
      value: (
        <div>
          <div>{publishedOn}</div>
          <div className="text-xs text-muted-foreground">the day the reporter issued it</div>
        </div>
      ),
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
