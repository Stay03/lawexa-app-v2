import { parseCronExpression } from '@/lib/utils/cron';
import type { CreateRadarPayload, Radar } from '@/types/radar';

/**
 * form-model.ts — the radar form's values, validation, payload building, and
 * server-error mapping. Pure module (no React), shared by the create screen
 * and the settings sheet so the two modes cannot drift.
 *
 * DELIBERATELY NOT `lib/utils/radar-validation.ts`. That module is v1's —
 * built for react-hook-form + zod, both of which its import graph drags into
 * any bundle that touches it. The v2 form is plain controlled state, so the
 * limits and the payload semantics are restated here (they are the radar
 * form's own contract, and the v1 module dies with the route cutover). The
 * SEMANTICS are kept identical, above all the perimeter-array rule.
 *
 * ── THE PERIMETER-ARRAY RULE (from the API) ────────────────────────────────
 * PATCH replaces arrays WHOLESALE: an omitted array is untouched, a present
 * array overwrites the entire stored list. So the payload builder always
 * emits every array the form OWNS in full (sending one empty deliberately
 * clears it) — and never emits `entities`, which the v2 form does not
 * surface: omitting the key is what preserves whatever the backend holds
 * (v1 round-tripped hidden entity values through the form to get the same
 * guarantee; omission is the simpler correct spelling).
 */

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
  sourceLabelLength: 200,
} as const;

export interface RadarSourceValue {
  url: string;
  label: string;
}

export interface RadarFormValues {
  /** Edit-mode rename. Blank on create — the backend names the radar. */
  name: string;
  description: string;
  instructions: string;
  scheduleCron: string;
  timezone: string;
  /** Jurisdiction slugs — the backend resolves slugs unambiguously. */
  jurisdictions: string[];
  topics: string[];
  keywords: string[];
  sources: RadarSourceValue[];
  emailChannel: boolean;
  /** Create-only: dispatch an immediate first scan. */
  firstScan: boolean;
}

/** The form's addressable error slots. `form` is the whole-form message for a
 *  server error that matched no field — rendered in-page, never a toast. */
export type RadarFieldName =
  | 'name'
  | 'description'
  | 'instructions'
  | 'schedule_cron'
  | 'timezone'
  | 'jurisdictions'
  | 'topics'
  | 'keywords'
  | 'sources'
  | 'form';

export type RadarFieldErrors = Partial<Record<RadarFieldName, string>>;

export interface RadarFormValidation {
  fields: RadarFieldErrors;
  /** Per-row source-URL messages, keyed by row index. */
  sourceErrors: Record<number, string>;
  ok: boolean;
}

/**
 * The blank create form. `timezone` starts EMPTY on purpose: it means "the
 * device's zone, once the client resolves it" — the resolved value is derived
 * per render (`useDeviceTimeZone`) and only an explicit pick writes into the
 * stored values. Reading `Intl` here would run during SSR and hydrate a
 * different zone than the client renders (a guaranteed hydration error).
 */
export function emptyRadarFormValues(): RadarFormValues {
  return {
    name: '',
    description: '',
    instructions: '',
    scheduleCron: '0 8 * * *',
    timezone: '',
    jurisdictions: [],
    topics: [],
    keywords: [],
    sources: [],
    emailChannel: false,
    firstScan: true,
  };
}

export function radarFormValuesFromRadar(radar: Radar): RadarFormValues {
  return {
    name: radar.name,
    description: radar.description ?? '',
    instructions: radar.instructions ?? '',
    scheduleCron: radar.schedule_cron,
    timezone: radar.timezone,
    jurisdictions: radar.jurisdictions.map((jurisdiction) => jurisdiction.slug),
    topics: radar.topics,
    keywords: radar.keywords,
    sources: radar.sources.map((source) => ({
      url: source.url,
      label: source.label ?? '',
    })),
    emailChannel: radar.channels.some(
      (channel) => channel.type === 'email' && channel.active,
    ),
    firstScan: false,
  };
}

/** True when any collapsed "More options" field carries a value — the edit
 *  sheet opens the group when so, so nothing saved is ever hidden. */
export function hasAdvancedValues(values: RadarFormValues): boolean {
  return (
    values.description.trim().length > 0 ||
    values.instructions.trim().length > 0 ||
    values.keywords.length > 0 ||
    values.sources.length > 0
  );
}

function isValidSourceUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Client-side validation — only what the inputs cannot already enforce (chip
 * entry caps lengths and counts at the door; text fields carry `maxLength`).
 * What remains is the cron shape (reachable through the custom-cron fallback)
 * and each pinned source's URL.
 *
 * `timezone` is the RESOLVED zone (stored pick, else device zone) — `null`
 * only in the sliver before the client resolves it, in which case submit is
 * honestly refused rather than sending a zone nobody chose.
 */
export function validateRadarForm(
  values: RadarFormValues,
  timezone: string | null,
): RadarFormValidation {
  const fields: RadarFieldErrors = {};
  const sourceErrors: Record<number, string> = {};

  if (!values.scheduleCron.trim()) {
    fields.schedule_cron = 'Choose a schedule.';
  } else if (parseCronExpression(values.scheduleCron) === null) {
    fields.schedule_cron =
      'Enter a valid 5-field cron expression (minute hour day month weekday).';
  }

  if (!timezone?.trim()) {
    fields.timezone = 'Choose a timezone.';
  }

  values.sources.forEach((source, index) => {
    if (!source.url.trim()) {
      sourceErrors[index] = 'Enter a URL, or remove this source.';
    } else if (!isValidSourceUrl(source.url.trim())) {
      sourceErrors[index] = 'Enter a valid URL, e.g. https://example.com';
    }
  });
  if (Object.keys(sourceErrors).length > 0) {
    fields.sources = 'Check the highlighted sources.';
  }

  return {
    fields,
    sourceErrors,
    ok: Object.keys(fields).length === 0,
  };
}

/**
 * Build the API payload. `jurisdictions` and `timezone` arrive RESOLVED —
 * both carry a derived default the stored values deliberately do not hold
 * (untouched jurisdictions → profile country → Nigeria; untouched timezone →
 * device zone) — see `RadarForm`'s derived-default notes. The form refuses to
 * submit until both are derivable, so this never receives a guess.
 */
export function buildRadarPayload(
  values: RadarFormValues,
  resolved: { jurisdictions: string[]; timezone: string },
  options: { includeFirstScan: boolean },
): CreateRadarPayload {
  const name = values.name.trim();
  return {
    // Omit when blank: on create the backend auto-names the radar; on update
    // a missing key leaves the existing name untouched (PATCH is partial).
    ...(name ? { name } : {}),
    schedule_cron: values.scheduleCron.trim(),
    timezone: resolved.timezone,
    description: values.description.trim(),
    instructions: values.instructions.trim(),
    jurisdictions: resolved.jurisdictions,
    topics: values.topics,
    keywords: values.keywords,
    sources: values.sources.map((source) => {
      const label = source.label.trim();
      return label
        ? { url: source.url.trim(), label }
        : { url: source.url.trim() };
    }),
    channels: values.emailChannel ? ['in_app', 'email'] : ['in_app'],
    ...(options.includeFirstScan ? { first_scan: values.firstScan } : {}),
  };
}

const SERVER_FIELD_NAMES: ReadonlySet<string> = new Set([
  'name',
  'description',
  'instructions',
  'schedule_cron',
  'timezone',
  'jurisdictions',
  'topics',
  'keywords',
  'sources',
]);

/**
 * Map a 422 error bag onto the form's error slots. Indexed keys
 * ("jurisdictions.2", "sources.1.url") collapse onto their root field —
 * v1's proven rule — EXCEPT sources, whose row index is kept so the
 * offending row itself highlights (`sourceErrors`), exactly like the client
 * validation. Returns whether ANY message found a field: the caller only
 * claims "check the highlighted fields" when something really highlighted
 * (the study's honesty requirement); everything else lands in the `form`
 * slot as an in-page message.
 */
export function mapServerErrors(errors: Record<string, string[]>): {
  fields: RadarFieldErrors;
  sourceErrors: Record<number, string>;
  matched: boolean;
} {
  const fields: RadarFieldErrors = {};
  const sourceErrors: Record<number, string> = {};
  let matched = false;
  for (const [key, messages] of Object.entries(errors)) {
    const parts = key.split('.');
    const root = parts[0];
    if (!SERVER_FIELD_NAMES.has(root) || messages.length === 0) continue;
    fields[root as RadarFieldName] = messages[0];
    if (root === 'sources' && parts.length > 1) {
      const index = Number(parts[1]);
      if (Number.isInteger(index) && index >= 0 && !(index in sourceErrors)) {
        sourceErrors[index] = messages[0];
      }
    }
    matched = true;
  }
  return { fields, sourceErrors, matched };
}
