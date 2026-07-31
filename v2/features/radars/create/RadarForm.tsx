'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/lib/stores/authStore';
import { jurisdictionsQueries } from '@/v2/features/jurisdictions/queries';
import { useV2Session } from '@/v2/runtime/session-context';
import type { CreateRadarPayload, Radar } from '@/types/radar';
import { ChipsField } from './ChipsField';
import { JurisdictionsField } from './JurisdictionsField';
import { ReviewDialog } from './ReviewDialog';
import { SchedulePicker } from './SchedulePicker';
import { SourcesField } from './SourcesField';
import { useDeviceTimeZone } from './use-device-timezone';
import {
  RADAR_LIMITS,
  buildRadarPayload,
  emptyRadarFormValues,
  hasAdvancedValues,
  mapServerErrors,
  radarFormValuesFromRadar,
  validateRadarForm,
  type RadarFieldErrors,
  type RadarFormValues,
} from './form-model';

/**
 * RadarForm — the one radar form, in two modes: `create` (the `/radars/new`
 * page) and `edit` (the detail's settings sheet). Plain controlled state —
 * no form library: the field set is small, the interesting controls (chips,
 * schedule, timezone) are custom anyway, and the v2 tree carries no
 * react-hook-form to lean on.
 *
 * ── THE 80% PATH ────────────────────────────────────────────────────────────
 * Say what to track, pick a schedule, create. Description, keywords, pinned
 * sources and agent instructions live in one collapsed "More options" group
 * with a configured-count badge (open on edit when any carries a value, so
 * nothing saved is ever hidden).
 *
 * ── UNTOUCHED DEFAULTS ARE DERIVED, NOT WRITTEN ─────────────────────────────
 * Two fields promise a default the stored values never hold:
 *
 *  JURISDICTIONS  until touched, the effective selection is the profile
 *                 country (falling back to Nigeria, the backend's documented
 *                 default). v1 wrote this with `setValue` in an effect — the
 *                 setState-in-effect shape the React Compiler lint bans; the
 *                 derived form keeps the same behaviour (removing the default
 *                 deliberately sticks) with no effect writes. While the list
 *                 has not resolved the default is UNDERIVABLE, and submit is
 *                 HELD with an inline field error — an early submit must
 *                 never create a radar with silently-no jurisdiction.
 *  TIMEZONE       until picked, the effective zone is the DEVICE zone — a
 *                 client-only value (`useDeviceTimeZone`: null on the server
 *                 and the hydration render, so SSR and client paint one
 *                 identical held shape and no hydration error is possible).
 *                 Validation refuses the (practically unreachable) submit
 *                 before it resolves.
 *
 * ── HONEST ERROR MAPPING ────────────────────────────────────────────────────
 * Server 422s land on their fields via `mapServerErrors` (row-indexed source
 * errors highlight their own row); a message that matched no field renders as
 * an IN-PAGE banner above the submit row, never a toast (the study's rule:
 * only claim highlights when something really highlighted). Whenever a mapped
 * error lives inside the collapsed "More options" group, the group OPENS and
 * focus moves to the first invalid control — an error behind a closed fold is
 * an error nobody sees. Client validation runs the same channel.
 */

const DEFAULT_JURISDICTION_FALLBACK_SLUG = 'nigeria';

/** The fields that live inside the collapsed "More options" group — an error
 *  on any of them opens the group before focus moves. */
const GROUP_FIELDS = [
  'description',
  'instructions',
  'keywords',
  'sources',
] as const;

export interface RadarFormHelpers {
  /** Map a 422 error bag onto fields; false when nothing matched. */
  applyServerErrors: (errors: Record<string, string[]>) => boolean;
  /** Show a whole-form, in-page error message (near the submit row). */
  setFormError: (message: string) => void;
}

function SectionLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-xs text-muted-foreground">
      {children}
    </p>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

export function RadarForm({
  mode,
  radar,
  isSubmitting,
  submitLabel,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  radar?: Radar;
  isSubmitting: boolean;
  submitLabel: string;
  onSubmit: (payload: CreateRadarPayload, helpers: RadarFormHelpers) => void;
}) {
  const uid = useId();
  const { signedIn } = useV2Session();
  const userEmail = useAuthStore((s) => s.user?.email);
  const profileCountry = useAuthStore((s) => s.user?.profile?.country);
  const { data: jurisdictions } = useQuery({
    ...jurisdictionsQueries.list(),
    enabled: signedIn,
  });

  const formRef = useRef<HTMLFormElement | null>(null);
  const deviceZone = useDeviceTimeZone();

  const [values, setValues] = useState<RadarFormValues>(() =>
    radar ? radarFormValuesFromRadar(radar) : emptyRadarFormValues(),
  );
  const [errors, setErrors] = useState<RadarFieldErrors>({});
  const [sourceErrors, setSourceErrors] = useState<Record<number, string>>({});
  const [moreOpen, setMoreOpen] = useState(
    () => radar !== undefined && hasAdvancedValues(radarFormValuesFromRadar(radar)),
  );
  // `pendingValues !== null` doubles as the review dialog's open state.
  const [pendingValues, setPendingValues] = useState<RadarFormValues | null>(
    null,
  );

  // The derived jurisdiction default — see the docblock.
  const [jurisdictionsTouched, setJurisdictionsTouched] = useState(
    mode === 'edit',
  );
  const defaultJurisdictionSlug = useMemo(() => {
    if (!jurisdictions) return null;
    const needle = profileCountry?.trim().toLowerCase();
    const fromProfile = needle
      ? jurisdictions.find(
          (jurisdiction) =>
            jurisdiction.name.toLowerCase() === needle ||
            jurisdiction.code.toLowerCase() === needle,
        )
      : undefined;
    const match =
      fromProfile ??
      jurisdictions.find(
        (jurisdiction) =>
          jurisdiction.slug === DEFAULT_JURISDICTION_FALLBACK_SLUG,
      );
    return match?.slug ?? null;
  }, [jurisdictions, profileCountry]);
  const effectiveJurisdictions = jurisdictionsTouched
    ? values.jurisdictions
    : defaultJurisdictionSlug
      ? [defaultJurisdictionSlug]
      : [];

  // The resolved timezone: an explicit pick, else the device zone (null on
  // the server + hydration render — see the docblock).
  const effectiveTimezone = values.timezone || deviceZone;

  const set = <K extends keyof RadarFormValues>(
    key: K,
    value: RadarFormValues[K],
  ) => {
    setValues((previous) => ({ ...previous, [key]: value }));
  };
  const clearError = (key: keyof RadarFieldErrors) => {
    setErrors((previous) => {
      if (!(key in previous)) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  };

  const configuredCount =
    (values.description.trim() ? 1 : 0) +
    (values.instructions.trim() ? 1 : 0) +
    (values.keywords.length > 0 ? 1 : 0) +
    (values.sources.length > 0 ? 1 : 0);

  /** Move focus to the first invalid control once the error state (and, when
   *  needed, the opened group) has committed. Two frames: one for the state
   *  commit, one for the Collapsible content to mount. Scoped to THIS form.
   *  `data-invalid` covers controls whose role forbids `aria-invalid` (the
   *  jurisdictions trigger). */
  const focusFirstInvalid = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>(
            '[aria-invalid="true"], [data-invalid="true"]',
          )
          ?.focus();
      });
    });
  };

  /** Open "More options" when any of its fields carries an error. */
  const revealGroupErrors = (fields: RadarFieldErrors) => {
    if (GROUP_FIELDS.some((field) => fields[field])) setMoreOpen(true);
  };

  const helpers: RadarFormHelpers = {
    applyServerErrors: (bag) => {
      const mapped = mapServerErrors(bag);
      if (mapped.matched) {
        setErrors(mapped.fields);
        setSourceErrors(mapped.sourceErrors);
        revealGroupErrors(mapped.fields);
        focusFirstInvalid();
      }
      return mapped.matched;
    },
    setFormError: (message) => {
      setErrors((previous) => ({ ...previous, form: message }));
    },
  };

  const submit = (submitValues: RadarFormValues) => {
    const timezone = submitValues.timezone || deviceZone;
    // Unreachable in practice — validation holds submit until the zone is
    // resolvable — but the payload must never carry a fabricated zone.
    if (!timezone) return;
    onSubmit(
      buildRadarPayload(
        submitValues,
        { jurisdictions: effectiveJurisdictions, timezone },
        { includeFirstScan: mode === 'create' },
      ),
      helpers,
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateRadarForm(values, effectiveTimezone);
    // The jurisdiction promise (profile country → Nigeria) is not derivable
    // until the list resolves. Sending `jurisdictions: []` then would create
    // a silently-unscoped radar — so submit is HELD, honestly, on the field.
    if (
      mode === 'create' &&
      !jurisdictionsTouched &&
      defaultJurisdictionSlug === null
    ) {
      validation.fields.jurisdictions =
        'The country list is still loading — pick a jurisdiction, or try again in a moment.';
      validation.ok = false;
    }
    setErrors(validation.fields);
    setSourceErrors(validation.sourceErrors);
    if (!validation.ok) {
      revealGroupErrors(validation.fields);
      focusFirstInvalid();
      return;
    }
    if (mode === 'create') {
      setPendingValues(values);
      return;
    }
    submit(values);
  };

  const handleConfirm = () => {
    if (!pendingValues) return;
    const confirmed = pendingValues;
    setPendingValues(null);
    submit(confirmed);
  };

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-7">
        {/* Create leaves naming to the backend (instant fallback, then the
            async AI title with the shimmer on the detail). Editing renames. */}
        {mode === 'edit' ? (
          <div className="space-y-1.5">
            <SectionLabel htmlFor={`${uid}-name`}>Name</SectionLabel>
            <Input
              id={`${uid}-name`}
              value={values.name}
              onChange={(event) => {
                set('name', event.target.value);
                clearError('name');
              }}
              maxLength={RADAR_LIMITS.name}
              placeholder="e.g. NDPA Enforcement Updates — Nigeria"
              aria-invalid={!!errors.name || undefined}
              aria-describedby={errors.name ? `${uid}-name-error` : undefined}
            />
            <FieldError id={`${uid}-name-error`} message={errors.name} />
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">What to track</p>
          <div className="grid items-start gap-3 sm:grid-cols-[2fr_3fr]">
            <div className="space-y-1.5">
              <FieldHint>Jurisdictions</FieldHint>
              <JurisdictionsField
                value={effectiveJurisdictions}
                onChange={(next) => {
                  setJurisdictionsTouched(true);
                  set('jurisdictions', next);
                  clearError('jurisdictions');
                }}
                signedIn={signedIn}
                describedBy={
                  errors.jurisdictions ? `${uid}-jurisdictions-error` : undefined
                }
                invalid={!!errors.jurisdictions}
              />
              <FieldError
                id={`${uid}-jurisdictions-error`}
                message={errors.jurisdictions}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${uid}-topics`} className="text-xs text-muted-foreground">
                Topics
              </label>
              <ChipsField
                id={`${uid}-topics`}
                value={values.topics}
                onChange={(next) => {
                  set('topics', next);
                  clearError('topics');
                }}
                itemNoun="topic"
                placeholder="e.g. NDPA enforcement"
                maxItems={RADAR_LIMITS.topics}
                maxItemLength={RADAR_LIMITS.topicLength}
                describedBy={
                  errors.topics ? `${uid}-topics-error` : `${uid}-topics-hint`
                }
                invalid={!!errors.topics}
              />
              <FieldHint id={`${uid}-topics-hint`}>
                Examples: data protection enforcement, fintech licensing, tax
                appeals, mergers &amp; acquisitions
              </FieldHint>
              <FieldError id={`${uid}-topics-error`} message={errors.topics} />
            </div>
          </div>
        </div>

        <SchedulePicker
          value={{ cron: values.scheduleCron, timezone: effectiveTimezone }}
          onChange={(next) => {
            set('scheduleCron', next.cron);
            // `null` means "still the unresolved device default" — leave the
            // stored value untouched so the derivation keeps working.
            if (next.timezone !== null) set('timezone', next.timezone);
            clearError('schedule_cron');
            clearError('timezone');
          }}
          error={errors.schedule_cron ?? errors.timezone}
          errorId={`${uid}-schedule-error`}
        />

        <Collapsible
          open={moreOpen}
          onOpenChange={setMoreOpen}
          className="rounded-xl border"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted/40"
            >
              <span className="flex items-center gap-2">
                More options
                {configuredCount > 0 ? (
                  <span className="inline-flex min-h-5 items-center rounded-full bg-secondary px-2 text-[11px] font-medium tabular-nums text-secondary-foreground">
                    {configuredCount} set
                  </span>
                ) : null}
              </span>
              <ChevronDown
                aria-hidden
                className={cn(
                  'size-4 text-muted-foreground transition-transform motion-reduce:transition-none',
                  moreOpen && 'rotate-180',
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-5 border-t px-4 py-4">
            <div className="space-y-1.5">
              <label
                htmlFor={`${uid}-description`}
                className="text-xs text-muted-foreground"
              >
                Description
              </label>
              <Textarea
                id={`${uid}-description`}
                rows={2}
                value={values.description}
                onChange={(event) => {
                  set('description', event.target.value);
                  clearError('description');
                }}
                maxLength={RADAR_LIMITS.description}
                placeholder="A short note on what this radar tracks"
                aria-invalid={!!errors.description || undefined}
              />
              <FieldError
                id={`${uid}-description-error`}
                message={errors.description}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`${uid}-keywords`}
                className="text-xs text-muted-foreground"
              >
                Keywords — exact phrases the radar should detect
              </label>
              <ChipsField
                id={`${uid}-keywords`}
                value={values.keywords}
                onChange={(next) => {
                  set('keywords', next);
                  clearError('keywords');
                }}
                itemNoun="keyword"
                placeholder="e.g. NDPC, data protection fine"
                maxItems={RADAR_LIMITS.keywords}
                maxItemLength={RADAR_LIMITS.keywordLength}
                describedBy={
                  errors.keywords ? `${uid}-keywords-error` : undefined
                }
                invalid={!!errors.keywords}
              />
              <FieldError
                id={`${uid}-keywords-error`}
                message={errors.keywords}
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Pinned sources — URLs checked on every scan
              </p>
              <SourcesField
                value={values.sources}
                onChange={(next) => {
                  set('sources', next);
                  clearError('sources');
                  setSourceErrors({});
                }}
                errors={sourceErrors}
              />
              <FieldError id={`${uid}-sources-error`} message={errors.sources} />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor={`${uid}-instructions`}
                className="text-xs text-muted-foreground"
              >
                Custom instructions
              </label>
              <Textarea
                id={`${uid}-instructions`}
                rows={4}
                value={values.instructions}
                onChange={(event) => {
                  set('instructions', event.target.value);
                  clearError('instructions');
                }}
                maxLength={RADAR_LIMITS.instructions}
                placeholder="e.g. Prioritise enforcement actions and fines over policy commentary."
                aria-invalid={!!errors.instructions || undefined}
              />
              <FieldError
                id={`${uid}-instructions-error`}
                message={errors.instructions}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className="divide-y rounded-xl border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <label
                htmlFor={`${uid}-email`}
                className="text-sm font-medium text-foreground"
              >
                Email reports
              </label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {userEmail ? `Sent to ${userEmail} — reports` : 'Reports'}{' '}
                always appear in-app and in your notifications.
              </p>
            </div>
            <Switch
              id={`${uid}-email`}
              checked={values.emailChannel}
              onCheckedChange={(checked) => set('emailChannel', checked)}
            />
          </div>

          {mode === 'create' ? (
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <label
                  htmlFor={`${uid}-first-scan`}
                  className="text-sm font-medium text-foreground"
                >
                  Run first scan now
                </label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Get your first report right away instead of waiting for the
                  schedule.
                </p>
              </div>
              <Switch
                id={`${uid}-first-scan`}
                checked={values.firstScan}
                onCheckedChange={(checked) => set('firstScan', checked)}
              />
            </div>
          ) : null}
        </div>

        {/* The whole-form error — in-page, beside the action it blocks. */}
        {errors.form ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {errors.form}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : null}
            {submitLabel}
          </Button>
        </div>
      </form>

      {mode === 'create' ? (
        <ReviewDialog
          values={pendingValues}
          jurisdictionSlugs={effectiveJurisdictions}
          // Resolved by the time the dialog can open (validation holds submit
          // until the zone exists); the fallback only satisfies the type.
          timezone={effectiveTimezone ?? ''}
          isSubmitting={isSubmitting}
          onConfirm={handleConfirm}
          onCancel={() => setPendingValues(null)}
        />
      ) : null}
    </>
  );
}
