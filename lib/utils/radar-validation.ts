import { z } from 'zod';
import type { Path, UseFormSetError } from 'react-hook-form';

import { parseCronExpression } from '@/lib/utils/cron';
import type {
  CreateRadarPayload,
  Radar,
  RadarEntityType,
} from '@/types/radar';

export const RADAR_LIMITS = {
  name: 200,
  description: 2000,
  instructions: 5000,
  jurisdictions: 20,
  topics: 20,
  topicLength: 200,
  keywords: 30,
  keywordLength: 200,
  sources: 20,
  entities: 20,
} as const;

export const radarFormSchema = z.object({
  // Optional: a blank name is omitted from the payload so the backend names
  // the radar (instant fallback, then an async AI-generated title).
  name: z
    .string()
    .max(RADAR_LIMITS.name, `Name cannot exceed ${RADAR_LIMITS.name} characters`),
  description: z
    .string()
    .max(
      RADAR_LIMITS.description,
      `Description cannot exceed ${RADAR_LIMITS.description} characters`
    ),
  instructions: z
    .string()
    .max(
      RADAR_LIMITS.instructions,
      `Instructions cannot exceed ${RADAR_LIMITS.instructions} characters`
    ),
  schedule_cron: z
    .string()
    .min(1, 'Choose a schedule')
    .refine(
      (value) => parseCronExpression(value) !== null,
      'Enter a valid 5-field cron expression (minute hour day month weekday)'
    ),
  timezone: z.string().min(1, 'Choose a timezone'),
  jurisdictions: z
    .array(z.string())
    .max(RADAR_LIMITS.jurisdictions, `At most ${RADAR_LIMITS.jurisdictions} jurisdictions`),
  topics: z
    .array(
      z
        .string()
        .max(RADAR_LIMITS.topicLength, `Each topic is limited to ${RADAR_LIMITS.topicLength} characters`)
    )
    .max(RADAR_LIMITS.topics, `At most ${RADAR_LIMITS.topics} topics`),
  keywords: z
    .array(
      z
        .string()
        .max(RADAR_LIMITS.keywordLength, `Each keyword is limited to ${RADAR_LIMITS.keywordLength} characters`)
    )
    .max(RADAR_LIMITS.keywords, `At most ${RADAR_LIMITS.keywords} keywords`),
  sources: z
    .array(
      z.object({
        url: z.url('Enter a valid URL, e.g. https://example.com'),
        label: z.string().max(200, 'Label is limited to 200 characters'),
      })
    )
    .max(RADAR_LIMITS.sources, `At most ${RADAR_LIMITS.sources} pinned sources`),
  entities: z
    .array(
      z.object({
        entity_type: z.enum(['case', 'statute', 'court', 'judge', 'note']),
        entity_id: z.number().int().positive(),
        label: z.string(),
        sublabel: z.string().optional(),
      })
    )
    .max(RADAR_LIMITS.entities, `At most ${RADAR_LIMITS.entities} watched entities`),
  email_channel: z.boolean(),
  first_scan: z.boolean(),
});

export type RadarFormValues = z.infer<typeof radarFormSchema>;

const ENTITY_TYPE_LABELS: Record<RadarEntityType, string> = {
  case: 'Case',
  statute: 'Statute',
  court: 'Court',
  judge: 'Judge',
  note: 'Note',
};

export function radarEntityTypeLabel(type: RadarEntityType): string {
  return ENTITY_TYPE_LABELS[type];
}

export function emptyRadarFormValues(timezone: string): RadarFormValues {
  return {
    name: '',
    description: '',
    instructions: '',
    schedule_cron: '0 8 * * *',
    timezone,
    jurisdictions: [],
    topics: [],
    keywords: [],
    sources: [],
    entities: [],
    email_channel: false,
    first_scan: true,
  };
}

export function radarFormValuesFromRadar(radar: Radar): RadarFormValues {
  return {
    name: radar.name,
    description: radar.description ?? '',
    instructions: radar.instructions ?? '',
    schedule_cron: radar.schedule_cron,
    timezone: radar.timezone,
    jurisdictions: radar.jurisdictions.map((jurisdiction) => jurisdiction.slug),
    topics: radar.topics,
    keywords: radar.keywords,
    sources: radar.sources.map((source) => ({
      url: source.url,
      label: source.label ?? '',
    })),
    entities: radar.entities.map((entity) => ({
      entity_type: entity.entity_type,
      entity_id: entity.entity_id,
      label:
        entity.label ??
        `${radarEntityTypeLabel(entity.entity_type)} #${entity.entity_id}`,
    })),
    email_channel: radar.channels.some(
      (channel) => channel.type === 'email' && channel.active
    ),
    first_scan: false,
  };
}

/**
 * Build the API payload from form values. Every perimeter array is always
 * present — PATCH replaces arrays wholesale, so omitting one on update would
 * be a silent no-op while including it empty intentionally clears it.
 * Empty optional strings are sent as-is; the backend treats them as null.
 */
export function buildRadarPayload(
  values: RadarFormValues,
  options: { includeFirstScan: boolean }
): CreateRadarPayload {
  const name = values.name.trim();
  return {
    // Omit when blank: on create the backend auto-names the radar; on update
    // a missing key leaves the existing name untouched (PATCH is partial).
    ...(name ? { name } : {}),
    schedule_cron: values.schedule_cron.trim(),
    timezone: values.timezone,
    description: values.description.trim(),
    instructions: values.instructions.trim(),
    jurisdictions: values.jurisdictions,
    topics: values.topics,
    keywords: values.keywords,
    sources: values.sources.map((source) => {
      const label = source.label.trim();
      return label ? { url: source.url.trim(), label } : { url: source.url.trim() };
    }),
    entities: values.entities.map((entity) => ({
      entity_type: entity.entity_type,
      entity_id: entity.entity_id,
    })),
    channels: values.email_channel ? ['in_app', 'email'] : ['in_app'],
    ...(options.includeFirstScan ? { first_scan: values.first_scan } : {}),
  };
}

const FORM_FIELD_NAMES: ReadonlySet<string> = new Set([
  'name',
  'description',
  'instructions',
  'schedule_cron',
  'timezone',
  'jurisdictions',
  'topics',
  'keywords',
  'sources',
  'entities',
]);

/**
 * Map a 422 error bag onto form fields. Indexed keys ("jurisdictions.2",
 * "sources.1.url") collapse onto their root field. Returns true when at
 * least one message was attached — callers toast the response otherwise.
 */
export function applyRadarServerErrors(
  setError: UseFormSetError<RadarFormValues>,
  errors: Record<string, string[]>
): boolean {
  let applied = false;
  for (const [key, messages] of Object.entries(errors)) {
    const root = key.split('.')[0];
    if (!FORM_FIELD_NAMES.has(root) || messages.length === 0) continue;
    setError(root as Path<RadarFormValues>, { message: messages[0] });
    applied = true;
  }
  return applied;
}
