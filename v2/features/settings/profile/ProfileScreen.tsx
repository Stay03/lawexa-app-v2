'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AtSign,
  Award,
  Briefcase,
  Building,
  Building2,
  Cake,
  CalendarDays,
  GraduationCap,
  Globe,
  House,
  IdCard,
  Landmark,
  Linkedin,
  Facebook,
  Link2,
  Loader2,
  MapPin,
  NotebookPen,
  Scale,
  School,
  Tags,
  Twitter,
  UserPen,
  VenusAndMars,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { PROFESSION_OPTIONS, getLevelOptions } from '@/types/onboarding';
import type { User, UserType } from '@/types/auth';
import type { StudentEducationLevel } from '@/types/onboarding';
import { useV2Session } from '@/v2/runtime/session-context';
import {
  SettingsChoiceGroup,
  SettingsFormGroup,
  SettingsPickerField,
  SettingsSelectField,
  SettingsTextAreaField,
  SettingsTextField,
  type SettingsChoice,
} from '../SettingsForm';
import { SETTINGS_COLUMN } from '../SettingsList';
import { OptionPicker } from './OptionPicker';
import { ProfileHero } from './ProfileHero';
import {
  PROFILE_LIMITS,
  buildProfilePayload,
  hasChanges,
  mapServerErrors,
  normaliseUsername,
  profileFormValuesFromUser,
  settleProfileValues,
  validateProfileForm,
  visibilityFor,
  type ProfileFieldErrors,
  type ProfileFieldName,
  type ProfileFormValues,
} from './form-model';
import { useSaveProfile } from './mutations';
import { profileQueries } from './queries';
import {
  ProfileErrorState,
  ProfileFallback,
  ProfileGuestState,
  ProfileSignedOutState,
} from './states';

/**
 * ProfileScreen: the first settings option rebuilt in v2, and the one that
 * decides whether the settings design carries a form.
 *
 * ── IT IS A SCREEN YOU PUSHED INTO ─────────────────────────────────────────
 * Back arrow to `/settings`, "Profile" in the bar below `md:`, no hamburger,
 * and the page's own heading only from `md:` up where the bar's title is
 * hidden. None of that is decided here: it is a fact about the address, stated
 * once in `v2/shell/pushed-route.ts`.
 *
 * ── THE DESIGN IS THE SETTINGS INDEX, MADE TYPEABLE ────────────────────────
 * Same filled rounded blocks, same hairline between rows, same 56px rows, same
 * icon-then-label-then-quiet-line. The only change is that the quiet line is a
 * control (`SettingsForm.tsx` carries the reasoning). Above them sits ChatGPT's
 * profile treatment from the owner's third screenshot: one large centred avatar
 * with an edit badge, the name under it.
 *
 * ── WHICH ROWS APPEAR DEPENDS ON WHO THIS IS ───────────────────────────────
 * A lawyer is asked for a law school, a call number and a year of call; a
 * university student for a university and a level; somebody who is neither for
 * a profession. That is v1's rule and it is not restated here: the one function
 * that owns it (`lib/utils/profile-field-config.ts`) is imported by the form
 * model, so the two apps cannot disagree about what applies to whom.
 *
 * ── SAVING ─────────────────────────────────────────────────────────────────
 * The payload is a DIFF, so pressing Save writes exactly what changed and the
 * confirm is disabled until something has. A 422 lands on its own field in the
 * server's own words; anything the server said that matched no field is shown
 * in-page beside the button it blocked, never as a toast.
 */
export function ProfileScreen() {
  const { signedIn, role } = useV2Session();
  const hasAccount = signedIn && role !== 'guest';

  const query = useQuery({ ...profileQueries.me(), enabled: hasAccount });
  const user = query.data?.data?.user;

  if (!signedIn) {
    return (
      <ProfileColumn>
        <ProfileSignedOutState />
      </ProfileColumn>
    );
  }
  if (!hasAccount) {
    return (
      <ProfileColumn>
        <ProfileGuestState />
      </ProfileColumn>
    );
  }
  if (query.isError) {
    return (
      <ProfileColumn>
        <ProfileErrorState
          message={extractApiError(query.error).message}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      </ProfileColumn>
    );
  }
  if (query.isPending) return <ProfileFallback />;
  // Resolved, but with no account in it. That is a broken answer rather than a
  // slow one, so it must not be shown as a skeleton that never ends.
  if (!user) {
    return (
      <ProfileColumn>
        <ProfileErrorState
          message={query.data?.message || 'We could not read your account.'}
          onRetry={() => void query.refetch()}
          isRetrying={query.isFetching}
        />
      </ProfileColumn>
    );
  }

  return (
    <ProfileColumn>
      {/* Keyed on the account, so signing in as somebody else re-seeds the form
          rather than showing one person's edits over another's record. */}
      <ProfileForm key={user.id} user={user} />
    </ProfileColumn>
  );
}

/**
 * The column and the screen's one heading.
 *
 * ONE TITLE PER SCREEN, AT EVERY WIDTH: the shell's bar says "Profile" below
 * `md:`, so the heading is stated for assistive technology and drawn only from
 * `md:` up, where the bar's title is `display:none`.
 */
function ProfileColumn({ children }: { children: React.ReactNode }) {
  return (
    <div className={SETTINGS_COLUMN}>
      <h1 className="sr-only md:not-sr-only md:mb-5 md:text-2xl md:font-semibold md:tracking-tight md:text-foreground">
        Profile
      </h1>
      {children}
    </div>
  );
}

const ACCOUNT_TYPES: readonly SettingsChoice<UserType>[] = [
  {
    value: 'lawyer',
    label: 'Lawyer',
    description: 'Practising lawyer or legal professional',
    icon: Scale,
  },
  {
    value: 'law_student',
    label: 'Law student',
    description: 'Studying law, or preparing for the bar',
    icon: GraduationCap,
  },
  {
    value: 'other',
    label: 'Something else',
    description: 'Business owner, researcher, journalist, or other',
    icon: Briefcase,
  },
];

const STUDY_PLACES: readonly SettingsChoice<StudentEducationLevel>[] = [
  { value: 'university', label: 'University', icon: School },
  { value: 'law_school', label: 'Law school', icon: Building2 },
];

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const;

const PROFESSIONS = PROFESSION_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

/**
 * Every value in the form except the one that is not a stored field:
 * `student_education_level` is local, so nothing can ever report an error
 * against it, and this guard is what lets the error map stay typed rather than
 * being cast open at the one call site that would need it.
 */
type AddressableField = Extract<keyof ProfileFormValues, ProfileFieldName>;

function isAddressableField(
  field: keyof ProfileFormValues,
): field is AddressableField {
  return field !== 'student_education_level';
}

function ProfileForm({ user }: { user: User }) {
  const formRef = useRef<HTMLFormElement>(null);
  const saveProfile = useSaveProfile();

  // Seeded ONCE, lazily. A background refetch landing while somebody is typing
  // must never rewrite the fields, and `original` is the record this diff is
  // measured against, so it moves only when a save succeeds.
  const [values, setValues] = useState<ProfileFormValues>(() =>
    profileFormValuesFromUser(user),
  );
  const [original, setOriginal] = useState<ProfileFormValues>(() =>
    profileFormValuesFromUser(user),
  );
  const [errors, setErrors] = useState<ProfileFieldErrors>({});
  const [picker, setPicker] = useState<'country' | 'expertise' | null>(null);

  const visibility = useMemo(() => visibilityFor(values), [values]);

  // The country ROW needs no list: what it shows is the string already stored.
  // So the 250-country fetch waits until somebody opens the picker, and the
  // static tier then keeps it for the rest of the session.
  const countriesQuery = useQuery({
    ...profileQueries.countries(),
    enabled: picker === 'country',
  });
  // Expertise is the other way round: the row shows the NAMES behind a list of
  // ids, so it has to be read as soon as the row is on screen.
  const expertiseQuery = useQuery({
    ...profileQueries.expertise(),
    enabled: visibility.showAreasOfExpertise,
  });
  const expertiseAreas = expertiseQuery.data?.data;
  const payload = useMemo(
    () => buildProfilePayload(values, original),
    [values, original],
  );
  const dirty = hasChanges(payload);

  const countryOptions = useMemo(
    () =>
      (countriesQuery.data ?? []).map((country) => ({
        id: country.name,
        label: country.name,
      })),
    [countriesQuery.data],
  );
  const expertiseOptions = useMemo(
    () =>
      (expertiseAreas ?? []).map((area) => ({
        id: String(area.id),
        label: area.name,
      })),
    [expertiseAreas],
  );

  const set = <K extends keyof ProfileFormValues>(
    field: K,
    value: ProfileFormValues[K],
  ) => {
    setValues((previous) => ({ ...previous, [field]: value }));
    // Touching a field answers whatever was said about it, and retires the
    // whole-form message, which was about the state the form was just in.
    setErrors((previous) => {
      if (!(field in previous) && previous.form === undefined) return previous;
      const next = { ...previous };
      if (isAddressableField(field)) delete next[field];
      delete next.form;
      return next;
    });
  };

  /**
   * Choosing a type also settles what depends on it, IN THE FORM. What it does
   * to the RECORD is decided in one place, at save time
   * (`settleProfileValues`), so nothing here has to remember which fields a
   * lawyer stops having.
   */
  const chooseType = (type: UserType) => {
    // Changing the type changes which rows exist, so every message on screen is
    // now about a question that may no longer be asked.
    setErrors({});
    setValues((previous) => ({
      ...previous,
      user_type: type,
      student_education_level:
        type === 'law_student' ? previous.student_education_level : null,
      // The two types that name their own profession keep it derived, so the
      // picker a third type opens should not start out saying "Lawyer".
      profession:
        type === 'other' &&
        (previous.profession === 'lawyer' || previous.profession === 'student')
          ? ''
          : previous.profession,
    }));
  };

  /** Move focus to the first control the form is refusing, once the error
   *  state has committed. Scoped to THIS form. */
  const focusFirstInvalid = () => {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateProfileForm(values, visibility);
    setErrors(validation.fields);
    if (!validation.ok) {
      focusFirstInvalid();
      return;
    }
    if (!dirty) return;

    saveProfile.mutate(payload, {
      onSuccess: () => {
        // THE NEW BASELINE IS WHAT WE SENT, not what came back. The response is
        // trusted for the record it puts back in the cache, but this form has
        // to keep measuring against the exact values it wrote, even if the
        // response omits a field it does not know this screen owns.
        const saved = settleProfileValues(values, original);
        setOriginal(saved);
        // And the FIELDS are settled against that new baseline rather than
        // replaced by it, so a save that overlapped somebody still typing keeps
        // their words. It also puts back the two things that cannot be removed:
        // a handle or a type emptied on screen reappears, because emptying one
        // was never a request the server could carry out.
        setValues((current) => settleProfileValues(current, saved));
        setErrors({});
        toast.success('Profile saved');
      },
      onError: (error) => {
        const apiError = extractApiError(error);
        const mapped = apiError.errors
          ? mapServerErrors(apiError.errors)
          : { fields: {}, matched: false };
        setErrors(mapped.matched ? mapped.fields : { form: apiError.message });
        if (mapped.matched) focusFirstInvalid();
      },
    });
  };

  const selectedExpertise = (expertiseAreas ?? []).filter((area) =>
    values.areas_of_expertise.includes(area.id),
  );
  const expertiseValue =
    values.areas_of_expertise.length === 0
      ? null
      : selectedExpertise.length > 0
        ? selectedExpertise.map((area) => area.name).join(', ')
        : `${values.areas_of_expertise.length} chosen`;

  // The level names depend on the country ("300 Level" in Nigeria, "Junior" in
  // the United States), so a stored level can fall outside the list the current
  // country produces. It is added back rather than dropped: a select whose
  // value is not among its items shows its placeholder, which would tell this
  // person their level is unset while the record still holds it.
  const levelNames = getLevelOptions(values.country);
  const levelOptions = (
    values.level && !levelNames.includes(values.level)
      ? [values.level, ...levelNames]
      : levelNames
  ).map((level) => ({ value: level, label: level }));

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
    >
      <ProfileHero user={user} />

      <div className="flex flex-col gap-5">
        <SettingsFormGroup id="you" label="You">
          <SettingsTextField
            icon={UserPen}
            label="Full name"
            value={values.name}
            onChange={(value) => set('name', value)}
            error={errors.name}
            placeholder="Your full name"
            maxLength={PROFILE_LIMITS.name}
            autoComplete="name"
          />
          <SettingsTextField
            icon={AtSign}
            label="Username"
            value={values.username}
            onChange={(value) => set('username', normaliseUsername(value))}
            error={errors.username}
            hint={
              original.username
                ? 'People type this to tag you in channels.'
                : 'Pick one so people can tag you in channels. It cannot be removed later.'
            }
            prefix="@"
            placeholder="yourhandle"
            maxLength={PROFILE_LIMITS.usernameMax}
            autoComplete="off"
            spellCheck={false}
          />
          <SettingsTextAreaField
            icon={NotebookPen}
            label="Bio"
            value={values.bio}
            onChange={(value) => set('bio', value)}
            error={errors.bio}
            placeholder="A line or two about yourself"
            maxLength={PROFILE_LIMITS.bio}
            rows={3}
          />
          <SettingsSelectField
            icon={VenusAndMars}
            label="Gender"
            value={values.gender}
            onChange={(value) => set('gender', value)}
            options={GENDERS}
            placeholder="Not set"
            error={errors.gender}
          />
          <SettingsTextField
            icon={Cake}
            label="Date of birth"
            type="date"
            value={values.date_of_birth}
            onChange={(value) => set('date_of_birth', value)}
            error={errors.date_of_birth}
            autoComplete="bday"
          />
        </SettingsFormGroup>

        <SettingsChoiceGroup
          name="profile-account-type"
          legend="Account type"
          description="This decides which details the rest of this screen asks for."
          value={values.user_type}
          options={ACCOUNT_TYPES}
          onChange={chooseType}
        />

        {visibility.showEducationLevelToggle ? (
          <SettingsChoiceGroup
            name="profile-study-place"
            legend="Where you study"
            value={values.student_education_level ?? ''}
            options={STUDY_PLACES}
            onChange={(value) => set('student_education_level', value)}
          />
        ) : null}

        {visibility.showProfession || visibility.showAreasOfExpertise ? (
          <SettingsFormGroup id="work" label="Your work">
            {visibility.showProfession ? (
              <SettingsSelectField
                icon={Briefcase}
                label="Profession"
                value={values.profession}
                onChange={(value) => set('profession', value)}
                options={PROFESSIONS}
                placeholder="Not set"
                error={errors.profession}
              />
            ) : null}
            {visibility.showAreasOfExpertise ? (
              <SettingsPickerField
                icon={Tags}
                label="Areas of expertise"
                value={expertiseValue}
                placeholder="None chosen"
                onOpen={() => setPicker('expertise')}
                error={errors.areas_of_expertise}
              />
            ) : null}
          </SettingsFormGroup>
        ) : null}

        <SettingsFormGroup id="where" label="Where you are">
          <SettingsPickerField
            icon={Globe}
            label="Country"
            value={values.country || null}
            placeholder="Not set"
            onOpen={() => setPicker('country')}
            error={errors.country}
          />
          <SettingsTextField
            icon={MapPin}
            label="State or region"
            value={values.state}
            onChange={(value) => set('state', value)}
            error={errors.state}
            placeholder="Not set"
            maxLength={PROFILE_LIMITS.state}
            autoComplete="address-level1"
          />
          <SettingsTextField
            icon={Building}
            label="City"
            value={values.city}
            onChange={(value) => set('city', value)}
            error={errors.city}
            placeholder="Not set"
            maxLength={PROFILE_LIMITS.city}
            autoComplete="address-level2"
          />
          <SettingsTextField
            icon={House}
            label="Address"
            value={values.address}
            onChange={(value) => set('address', value)}
            error={errors.address}
            placeholder="Not set"
            maxLength={PROFILE_LIMITS.address}
            autoComplete="street-address"
          />
        </SettingsFormGroup>

        {visibility.showEducationSection ? (
          <SettingsFormGroup id="education" label="Education and credentials">
            {visibility.showUniversity ? (
              <SettingsTextField
                icon={School}
                label="University"
                value={values.university}
                onChange={(value) => set('university', value)}
                error={errors.university}
                placeholder="Not set"
              />
            ) : null}
            {visibility.showLevel ? (
              <SettingsSelectField
                icon={GraduationCap}
                label="Level"
                value={values.level}
                onChange={(value) => set('level', value)}
                options={levelOptions}
                placeholder="Not set"
                error={errors.level}
              />
            ) : null}
            {visibility.showLawSchool ? (
              <SettingsTextField
                icon={Landmark}
                label="Law school"
                value={values.law_school}
                onChange={(value) => set('law_school', value)}
                error={errors.law_school}
                placeholder="Not set"
              />
            ) : null}
            {visibility.showCallToBarYear ? (
              <SettingsTextField
                icon={CalendarDays}
                label="Year of call"
                value={values.call_to_bar_year}
                onChange={(value) => set('call_to_bar_year', value)}
                error={errors.call_to_bar_year}
                placeholder="e.g. 2020"
                inputMode="numeric"
                maxLength={4}
              />
            ) : null}
            {visibility.showCallNumber ? (
              <SettingsTextField
                icon={IdCard}
                label="Call number"
                value={values.call_number}
                onChange={(value) => set('call_number', value)}
                error={errors.call_number}
                placeholder="Not set"
              />
            ) : null}
            {visibility.showOtherCertifications ? (
              <SettingsTextAreaField
                icon={Award}
                label="Other certifications"
                value={values.other_certifications}
                onChange={(value) => set('other_certifications', value)}
                error={errors.other_certifications}
                placeholder="Anything else you are certified in"
                rows={3}
              />
            ) : null}
            {visibility.showWorkExperience ? (
              <SettingsTextAreaField
                icon={Briefcase}
                label="Work experience"
                value={values.work_experience}
                onChange={(value) => set('work_experience', value)}
                error={errors.work_experience}
                placeholder="Where you have practised, and for how long"
                rows={4}
              />
            ) : null}
          </SettingsFormGroup>
        ) : null}

        <SettingsFormGroup id="links" label="Links">
          <SettingsTextField
            icon={Linkedin}
            label="LinkedIn"
            type="url"
            inputMode="url"
            value={values.linkedin_url}
            onChange={(value) => set('linkedin_url', value)}
            error={errors.linkedin_url}
            placeholder="https://linkedin.com/in/..."
            autoComplete="off"
            spellCheck={false}
          />
          <SettingsTextField
            icon={Link2}
            label="Website"
            type="url"
            inputMode="url"
            value={values.website_url}
            onChange={(value) => set('website_url', value)}
            error={errors.website_url}
            placeholder="https://yoursite.com"
            autoComplete="off"
            spellCheck={false}
          />
          <SettingsTextField
            icon={Twitter}
            label="X"
            type="url"
            inputMode="url"
            value={values.twitter_url}
            onChange={(value) => set('twitter_url', value)}
            error={errors.twitter_url}
            placeholder="https://x.com/..."
            autoComplete="off"
            spellCheck={false}
          />
          <SettingsTextField
            icon={Facebook}
            label="Facebook"
            type="url"
            inputMode="url"
            value={values.facebook_url}
            onChange={(value) => set('facebook_url', value)}
            error={errors.facebook_url}
            placeholder="https://facebook.com/..."
            autoComplete="off"
            spellCheck={false}
          />
        </SettingsFormGroup>
      </div>

      {/* THE CONFIRM RIDES THE BOTTOM EDGE. The form is long enough that a
          button at the end of it would be a scroll away from most of the rows
          it applies to, and both reference apps keep their confirm on screen.
          `sticky` inside the shell's own scroll region, never `fixed`: the
          shell is `100dvh - keyboard-inset`, so this rides above the on-screen
          keyboard for free. It is always rendered, so nothing appears or
          disappears under the reader's thumb; only its state changes. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border/70 bg-background/95 px-4 py-3 backdrop-blur-sm">
        {errors.form ? (
          <p
            role="alert"
            className="mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[13px] leading-snug text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          >
            {errors.form}
          </p>
        ) : null}
        <div className="flex items-center justify-end gap-3">
          <p className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
            {dirty ? 'Unsaved changes' : ''}
          </p>
          <Button type="submit" disabled={!dirty || saveProfile.isPending}>
            {saveProfile.isPending ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : null}
            {saveProfile.isPending ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      </div>

      <OptionPicker
        open={picker === 'country'}
        onOpenChange={(open) => setPicker(open ? 'country' : null)}
        title="Country"
        description="Where you are based. It also decides how study levels are named."
        searchLabel="Search countries"
        searchPlaceholder="Search countries"
        options={countryOptions}
        isLoading={countriesQuery.isPending}
        selected={values.country ? [values.country] : []}
        emptyMessage="No country matches that."
        onChange={(ids) => set('country', ids[0] ?? '')}
        onClear={() => set('country', '')}
      />

      <OptionPicker
        open={picker === 'expertise'}
        onOpenChange={(open) => setPicker(open ? 'expertise' : null)}
        title="Areas of expertise"
        description="The areas of law you work in. Choose as many as apply."
        searchLabel="Search areas of expertise"
        searchPlaceholder="Search areas"
        options={expertiseOptions}
        isLoading={expertiseQuery.isPending}
        selected={values.areas_of_expertise.map(String)}
        multiple
        emptyMessage="No area matches that."
        onChange={(ids) =>
          set(
            'areas_of_expertise',
            ids.map(Number).filter(Number.isInteger),
          )
        }
      />
    </form>
  );
}
