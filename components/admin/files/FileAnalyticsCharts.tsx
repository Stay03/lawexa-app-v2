'use client';

import { UploadsOverTimeChart } from './charts/UploadsOverTimeChart';
import { StorageOverTimeChart } from './charts/StorageOverTimeChart';
import { CategoryDistributionChart } from './charts/CategoryDistributionChart';
import { MimeTypeDistributionChart } from './charts/MimeTypeDistributionChart';
import type {
  FileAnalyticsCharts as FileAnalyticsChartsType,
  FileAnalyticsGranularity,
} from '@/types/admin-files';

interface FileAnalyticsChartsProps {
  charts: FileAnalyticsChartsType;
  granularity: FileAnalyticsGranularity;
}

export function FileAnalyticsCharts({ charts, granularity }: FileAnalyticsChartsProps) {
  return (
    <div className="space-y-6">
      {/* Uploads over time — full width */}
      <UploadsOverTimeChart data={charts.uploads_over_time} granularity={granularity} />

      {/* Storage over time — full width */}
      <StorageOverTimeChart data={charts.storage_over_time} granularity={granularity} />

      {/* Category + MIME type distribution — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryDistributionChart data={charts.category_distribution} />
        <MimeTypeDistributionChart data={charts.mime_type_distribution} />
      </div>
    </div>
  );
}
