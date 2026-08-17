'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  Cake,
  GraduationCap,
  Globe,
  Loader2,
  Scale,
  School,
  Tags,
  VenusAndMars,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { extractApiError } from '@/lib/utils/api-error';
import { PROFESSION_OPTIONS, getLevelOptions } from '@/types/onboarding';
import type { User, UserType } from '@/types/auth';
import type { StudentEducationLevel } from '@/types/onboarding';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import {
  SettingsChoiceGroup,
  SettingsFormGroup,
  SettingsPickerField,
  SettingsSelectField,
  SettingsTextField,
  type SettingsChoice,
} from '../SettingsForm';
import { SETTINGS_COLUMN } from '../SettingsList';
import { FieldPanel } from './FieldPanel';
import { OptionPicker } from './OptionPicker';
import { ProfileHero } from './ProfileHero';
import {
  PROFILE_TEXT_FIELDS,
  type ProfileTextFieldName,
} from './text-fields';
import {
  buildProfilePayload,
  hasChanges,
  mapServerErrors,
  profileFormValuesFromUser,
  settleProfileValues,
  validateProfileForm,
  visibilityFor,
  type ProfileFieldErrors,
  type ProfileFieldName,
  type ProfileFormValues,
} from './form-model';
import { useSaveProfile } from './mutations';
import { profileQueries, universityQueries } from './queries';
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
 * ── YOU DO NOT TYPE ON THIS SCREEN ─────────────────────────────────────────
 * Every typed field is a ROW showing what it holds, and tapping one opens a
 * panel holding that field alone (`FieldPanel.tsx`, which carries the owner's
 * words and the reasoning). What stayed inline, and why, is written at
 * `textRow` below.
 *
 * ── SAVING ─────────────────────────────────────────────────────────────────
 * The payload is a DIFF, so pressing Save writes exactly what changed and the
 * confirm is disabled until something has. A 422 lands on its own field in the
 * server's own words; anything the server said that matched no field is shown
 * in-page beside the button it blocked, never as a toast.
 *
 * A panel does not save. It hands its value back to this form and closes, the
 * row redraws, and the sticky bar becomes the one thing that writes: one
 * definition of saved, one diff, one place a refusal comes back to. The panel's
 * own confirm is therefore "Done", and it is disabled until the box holds
 * something different from the row, exactly as Save is disabled until the
 * record would change.
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

/**
 * The three kinds of person this product knows about.
 *
 * ── IT IS CHANGEABLE NOW, AND THIS PARAGRAPH USED TO SAY OTHERWISE ─────────
 * It said the save came back refused, because onboarding owned the only
 * endpoints that wrote an account type and declined once onboarding was over.
 * That was true when it was written and stopped being true on 17 August 2026,
 * when the endpoint shipped. Measured end to end rather than assumed: an
 * account holding no type was sent exactly what this form's diff sends, the
 * request returned 200, and the value read back.
 *
 * The control was never disabled and there is still no "this cannot be changed"
 * notice — the owner rejected that framing, and a control greyed out for a
 * limitation would have had to be found and un-greyed the day it lifted, which
 * is today.
 */
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
    /* NOT "Something else". @arthur, 17 August 2026: it "may appear dismissive
       to people". It is the third of three, so whatever it says is what a
       reader who is not a lawyer or a student reads about themselves. */
    label: 'Other roles',
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
  /**
   * The three panels on this screen live in the URL, so the device Back button
   * and the edge swipe close them.
   *
   * ── WHY THIS SCREEN WAS THE EXCEPTION ──────────────────────────────────────
   * `useUrlOverlay` is the one way a v2 overlay does this, built on the owner's
   * own instruction of 4 August 2026 ("all the modals and sidebar should be
   * like that"), and seventeen files across channels, spaces and organizations
   * already use it. These three did not: they held `useState`, so Back left the
   * page instead of closing the panel. The owner found it by swiping, 17 August
   * 2026 — "seems these panels don't have URLs or something?" — which is
   * exactly what it was.
   *
   * Worse, `FieldPanel` CLAIMED in its own notes that Back already worked. That
   * sentence is true of `ResponsiveOverlay`'s other callers, each of which does
   * this binding; it was never true of the component, which does no history
   * work by design. The promise was inherited, not implemented.
   *
   * TWO PARAMS, NOT ONE, because a panel can never be open at the same time as
   * another here but they are different families: `?field=` names which of the
   * sixteen typed rows is being edited, `?panel=` names which chooser is up.
   * One param holds one value, and the hook's own rule is that exactly one
   * component owns each.
   */
  const fieldPanel = useUrlOverlay('field');
  const chooser = useUrlOverlay('panel');

  /**
   * A URL is typed by people and restored by browsers, so neither param is
   * trusted. `?field=nonsense` must read as closed rather than open a panel
   * with no title and no control. (`canOpen` cannot do this: it refuses only
   * the keys explicitly set to `false`, so it is a blocklist, not a list of
   * what is allowed.)
   */
  const urlField = fieldPanel.value;
  const editingField =
    urlField && urlField in PROFILE_TEXT_FIELDS
      ? (urlField as ProfileTextFieldName)
      : null;
  const openChooser =
    chooser.value === 'country' ||
    chooser.value === 'expertise' ||
    chooser.value === 'university'
      ? chooser.value
      : null;

  /**
   * The university list, which is the SERVER'S list rather than ours.
   *
   * The owner, 17 August 2026: "for the university there should be a list like
   * in the onboarding there no list in the setting". He is right and it was a
   * real gap: onboarding offers the institutions we know about, and settings
   * asked the same person to type the name again from memory, into a box that
   * would happily accept a typo.
   *
   * TWO SOURCES, exactly as onboarding uses them. Nothing typed shows the
   * universities in the reader's own country, because that is almost always the
   * answer. Two characters or more searches every country, because students
   * abroad exist and a country list would strand them.
   */
  const [universitySearch, setUniversitySearch] = useState('');

  /**
   * The name survives the closing animation. `ResponsiveOverlay` stays mounted
   * while it plays its exit, and the param is already `null` by then, so a
   * panel reading only the live value would spend its exit blank.
   *
   * STATE SET IN THE EVENT, NOT A REF. A ref would do the job, but reading one
   * during render is banned here for the same reason writing one is — the house
   * rule is that render reads nothing that can change behind it — and `react-
   * hooks/refs` enforces it. Setting this in the tap handler costs one render
   * that was already happening, because opening the panel re-renders anyway.
   *
   * The one path that never runs the handler is a restored or typed URL, and it
   * arrives with the param already set, so the live value answers and this is
   * not consulted.
   */
  const [lastField, setLastField] = useState<ProfileTextFieldName | null>(null);
  const openField = (field: ProfileTextFieldName) => {
    setLastField(field);
    fieldPanel.show(field);
  };
  const heldField = editingField ?? lastField;

  const visibility = useMemo(() => visibilityFor(values), [values]);

  // The country ROW needs no list: what it shows is the string already stored.
  // So the 250-country fetch waits until somebody opens the picker, and the
  // static tier then keeps it for the rest of the session.
  const countriesQuery = useQuery({
    ...profileQueries.countries(),
    enabled: openChooser === 'country' || openChooser === 'university',
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

  /**
   * The reader's country CODE, which the profile does not store.
   *
   * It stores the country's NAME, because that is what every existing account
   * holds and what the study-level names key off. The university list is asked
   * for by code, so the two are joined here through the country list that is
   * already being fetched — rather than storing a second field, or asking the
   * server for a name it does not index on.
   */
  const countryCode = useMemo(() => {
    if (!values.country) return undefined;
    return (countriesQuery.data ?? []).find(
      (country) => country.name === values.country,
    )?.code;
  }, [countriesQuery.data, values.country]);

  const countryUniversities = useQuery(
    universityQueries.byCountry(
      openChooser === 'university' ? countryCode : undefined,
    ),
  );
  const universityMatches = useQuery(
    universityQueries.search(
      openChooser === 'university' ? universitySearch : '',
    ),
  );

  /**
   * Two characters is the server's own threshold for searching, so below it the
   * country list stays: a reader who has typed one letter should not watch the
   * list they were reading empty itself.
   */
  const universityOptions = useMemo(() => {
    const searching = universitySearch.trim().length >= 2;
    const rows = searching
      ? (universityMatches.data?.data ?? [])
      : (countryUniversities.data?.data ?? []);
    return rows.map((row) => ({ id: row.name, label: row.name }));
  }, [universitySearch, universityMatches.data, countryUniversities.data]);

  /**
   * `isFetching`, NOT `isPending`. A DISABLED query in TanStack v5 reports
   * `isPending: true` for ever — it has no data and never will until it is
   * enabled — so a picker asking `isPending` would show its skeletons
   * permanently to anyone with no country set, and to everyone if the country
   * service is unreachable. That is the endless skeleton, which is the exact
   * complaint this screen has been fixing all week.
   *
   * `isFetching` is false while disabled and true only while a request is
   * actually in flight, which is the question being asked.
   */
  const universitiesLoading =
    universitySearch.trim().length >= 2
      ? universityMatches.isFetching
      : countryUniversities.isFetching;

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

  /**
   * ONE TYPED FIELD, AS A ROW: the icon, the label, what it holds, and a way
   * in. Everything about how the field is presented comes from one table
   * (`text-fields.ts`), so this row and the panel behind it cannot disagree.
   *
   * ── WHAT DID NOT BECOME A PANEL, AND WHY ───────────────────────────────
   * Gender, profession and level are `select`s, and the date of birth is a date
   * input. Each of those already opens the platform's own thing on a tap: a
   * wheel, a list, a calendar, drawn by the phone and sized by the phone. A
   * panel around one of them would be a screen you open to open a second thing,
   * which is two layers of chrome for one choice and slower than what the
   * platform already does well.
   *
   * The country and the areas of expertise were panels before this change and
   * stay as they are: too many answers for a select, and one of them holds
   * several at once (`OptionPicker.tsx`).
   *
   * The account type and where you study are radio groups. Their whole point is
   * that you SEE the alternatives beside each other with a sentence on each,
   * and hiding three visible options behind a tap would take away the only
   * thing that makes them readable.
   */
  const textRow = (field: ProfileTextFieldName) => {
    const spec = PROFILE_TEXT_FIELDS[field];
    const held = values[field];
    return (
      <SettingsPickerField
        key={field}
        icon={spec.icon}
        label={spec.label}
        value={held ? `${spec.prefix ?? ''}${held}` : null}
        placeholder="Not set"
        onOpen={() => openField(field)}
        error={errors[field]}
      />
    );
  };

  /**
   * The form's own rules, asked about ONE candidate value. The panel calls it
   * before it hands anything back, so a mistake is answered where it was made
   * rather than at the foot of a screen the reader has to return to. It is the
   * same function the submit runs, given the values as they would be, so the
   * two can never disagree about what is acceptable.
   */
  const validateField = (
    field: ProfileTextFieldName,
    candidate: string,
  ): string | undefined => {
    const next: ProfileFormValues = { ...values };
    next[field] = candidate;
    return validateProfileForm(next, visibilityFor(next)).fields[field];
  };

  /**
   * Move focus to the first control the form is refusing, once the error state
   * has committed. Scoped to THIS form.
   *
   * Two marks, because there are two kinds of control on this screen and the
   * accessibility rules differ: a control that holds a value says
   * `aria-invalid`, and a row that only OPENS one cannot, since a button has no
   * validity to announce. The row marks itself with `data-invalid` instead and
   * this query accepts either, so a refusal against a field behind a panel
   * still moves the reader to the row that carries it.
   */
  const focusFirstInvalid = () => {
    requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>(
          '[aria-invalid="true"],[data-invalid="true"]',
        )
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
          {textRow('name')}
          {textRow('username')}
          {textRow('bio')}
          <SettingsSelectField
            icon={VenusAndMars}
            label="Gender"
            value={values.gender}
            onChange={(value) => set('gender', value)}
            options={GENDERS}
            placeholder="Not set"
            error={errors.gender}
          />
          {/* The one control still typed into on the page, and only in the
              sense that a date input is typed into: on a phone it opens the
              platform's calendar, which is a better answer than any panel. */}
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

        {/* ── THE ANSWER FOLLOWS THE QUESTION ───────────────────────────────
            This group used to sit below "Where you are", second from last.
            Choosing "University" above therefore raised a question whose answer
            — WHICH university, and at what level — was 1472px down a 1984px
            page, with two unrelated sections in between. The owner hit it on 17
            August 2026: "what about university, I can set it. How should it
            work?"

            Nobody noticed because the group only appears for some people, so on
            most accounts the gap does not exist to be seen.

            It is placed by WHEN IT APPEARS, not by topic: directly under the
            choice that reveals it. A lawyer has no "Where you study" block at
            all, so for them it follows the account type just as closely. */}
        {visibility.showEducationSection ? (
          <SettingsFormGroup id="education" label="Education and credentials">
            {/* A LIST, NOT A BOX. The owner, 17 August 2026: "for the
                university there should be a list like in the onboarding there
                no list in the setting". Onboarding offers the institutions we
                know; settings was asking the same person to retype the name
                from memory into a field that accepts any spelling of it. */}
            {visibility.showUniversity ? (
              <SettingsPickerField
                icon={School}
                label="University"
                value={values.university || null}
                placeholder="Not set"
                onOpen={() => chooser.show('university')}
                error={errors.university}
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
            {visibility.showLawSchool ? textRow('law_school') : null}
            {visibility.showCallToBarYear ? textRow('call_to_bar_year') : null}
            {visibility.showCallNumber ? textRow('call_number') : null}
            {visibility.showOtherCertifications
              ? textRow('other_certifications')
              : null}
            {visibility.showWorkExperience ? textRow('work_experience') : null}
          </SettingsFormGroup>
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
                onOpen={() => chooser.show('expertise')}
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
            onOpen={() => chooser.show('country')}
            error={errors.country}
          />
          {textRow('state')}
          {textRow('city')}
          {textRow('address')}
        </SettingsFormGroup>


        <SettingsFormGroup id="links" label="Links">
          {textRow('linkedin_url')}
          {textRow('website_url')}
          {textRow('twitter_url')}
          {textRow('facebook_url')}
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

      {/* ONE panel for sixteen rows. It is always rendered, like the two
          pickers under it, because an overlay unmounted while closed cannot
          play its exit. */}
      <FieldPanel
        open={editingField !== null}
        onOpenChange={fieldPanel.setOpen}
        spec={heldField ? PROFILE_TEXT_FIELDS[heldField] : null}
        value={heldField ? values[heldField] : ''}
        error={heldField ? errors[heldField] : undefined}
        validate={(candidate) =>
          heldField ? validateField(heldField, candidate) : undefined
        }
        onCommit={(next) => {
          if (heldField) set(heldField, next);
        }}
      />

      <OptionPicker
        {...chooser.bind('country')}
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
        {...chooser.bind('university')}
        title="University"
        description="Where you study. Search if it is not in the list below."
        searchLabel="Search universities"
        searchPlaceholder="Search universities"
        options={universityOptions}
        isLoading={universitiesLoading}
        selected={values.university ? [values.university] : []}
        /* THE EMPTY MESSAGE HAS TO SAY WHICH EMPTY IT IS. "No university
           matches that" is only true after a search. Said to somebody who has
           typed nothing — which is everybody whose country we do not know, and
           everybody who has not set one — it reports a failed search that never
           happened and reads as "we have no universities". */
        emptyMessage={
          universitySearch.trim().length >= 2
            ? 'No university matches that.'
            : countryCode
              ? 'No universities listed for your country yet. Search for yours.'
              : 'Search for your university by name.'
        }
        /* The server does the filtering; see OptionPicker's note. */
        onSearchChange={setUniversitySearch}
        /* And a reader whose university we have never heard of must still be
           able to say where they study. */
        allowCustomValue
        onChange={(ids) => set('university', ids[0] ?? '')}
        onClear={() => set('university', '')}
      />

      <OptionPicker
        {...chooser.bind('expertise')}
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
