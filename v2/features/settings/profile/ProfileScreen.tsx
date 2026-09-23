'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Briefcase,
  Building2,
  GraduationCap,
  Globe,
  Scale,
  School,
  Tags,
  VenusAndMars,
} from 'lucide-react';
import { toast } from 'sonner';

import { extractApiError } from '@/lib/utils/api-error';
import { PROFESSION_OPTIONS, getLevelOptions } from '@/types/onboarding';
import type { User, UserType } from '@/types/auth';
import type { StudentEducationLevel } from '@/types/onboarding';
import { useV2Session } from '@/v2/runtime/session-context';
import { useUrlOverlay } from '@/v2/runtime/use-url-overlay';
import {
  SettingsFormGroup,
  SettingsPickerField,
  type SettingsChoice,
} from '../SettingsForm';
import { ChoicePanel } from '../ChoicePanel';
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

/** The old onboarding list, for the ROW's label only, while the served list
 *  is loading. Every slug on it is also on the served list (af35312). */
const LEGACY_PROFESSION_LABELS = new Map<string, string>(
  PROFESSION_OPTIONS.map((option) => [option.value, option.label]),
);

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
    chooser.value === 'university' ||
    chooser.value === 'account-type' ||
    chooser.value === 'gender' ||
    chooser.value === 'profession' ||
    chooser.value === 'level' ||
    chooser.value === 'study-place' ||
    chooser.value === 'law-school'
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

  /* By ACCOUNT TYPE only. Read by the queries below, which need nothing that
     depends on where a law student studies; `visibility` further down adds
     that once the law-school list is known. */
  const typeVisibility = useMemo(() => visibilityFor(values), [values]);

  // The country ROW needs no list: what it shows is the string already stored.
  // So the 250-country fetch waits until somebody opens the picker, and the
  // static tier then keeps it for the rest of the session.
  const countriesQuery = useQuery({
    ...profileQueries.countries(),
    /* A law student needs the country CODE on load, to know whether their
       country has law schools to offer. One cached call either way. */
    enabled:
      openChooser === 'country' ||
      openChooser === 'university' ||
      values.user_type === 'law_student',
  });
  // Expertise is the other way round: the row shows the NAMES behind a list of
  // ids, so it has to be read as soon as the row is on screen.
  const expertiseQuery = useQuery({
    ...profileQueries.expertise(),
    enabled: typeVisibility.showAreasOfExpertise,
  });
  const expertiseAreas = expertiseQuery.data?.data;
  // Same reason as expertise: the row shows the NAME behind a stored slug.
  const professionsQuery = useQuery({
    ...profileQueries.professions(),
    enabled: typeVisibility.showProfession,
  });
  const professions = professionsQuery.data;
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

  /* ── THE LAW SCHOOL QUESTION IS ASKED ONLY WHERE WE HAVE LAW SCHOOLS ──────
     The owner, 23 September 2026, answering "should the profile ask where
     someone attended law school only when their country has law schools on
     our list?": "Yes". Nigeria has seven campuses on the list, and Ghana,
     Kenya and Uganda one each; most countries have none.

     So the list decides three things: whether "Where you study" is asked at
     all, what the Law school row offers, and, where the country has none,
     that a law student studies at a university. Until the list arrives the
     question stays offered, so nothing on screen vanishes on the first
     paint. A country we cannot resolve to a code asks for every law school. */
  const lawSchoolsQuery = useQuery(
    universityQueries.lawSchools(
      countryCode,
      values.user_type === 'law_student' &&
        (!values.country || countryCode !== undefined || countriesQuery.isSuccess),
    ),
  );
  const lawSchoolOptions = useMemo(
    () =>
      (lawSchoolsQuery.data?.data ?? []).map((school) => ({
        id: school.name,
        label: school.name,
      })),
    [lawSchoolsQuery.data],
  );
  const offersLawSchool =
    !lawSchoolsQuery.isSuccess || lawSchoolOptions.length > 0;
  const studyLevel =
    values.user_type === 'law_student' && !offersLawSchool
      ? 'university'
      : values.student_education_level;
  const visibility = useMemo(
    () => visibilityFor({ ...values, student_education_level: studyLevel }),
    [values, studyLevel],
  );

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
  const professionOptions = useMemo(
    () =>
      (professions ?? []).map((row) => ({ id: row.slug, label: row.name })),
    [professions],
  );
  const otherProfessionSlug = professions?.find((row) => row.is_other)?.slug;

  /* WHAT THE PROFESSION ROW SAYS. An exact slug match is a listed profession;
     anything else that is stored was typed under Other and is shown as typed.
     Until the list arrives, the old onboarding labels cover every stored slug
     they know. */
  const professionLabel = !values.profession
    ? null
    : (professions?.find((row) => row.slug === values.profession)?.name ??
      (professions
        ? values.profession
        : (LEGACY_PROFESSION_LABELS.get(values.profession) ??
          values.profession)));

  /**
   * Choosing a type also settles what depends on it, IN THE FORM. What it does
   * to the RECORD is decided in one place, at save time
   * (`settleProfileValues`), so nothing here has to remember which fields a
   * lawyer stops having.
   *
   * A PURE FUNCTION, because two callers need the same answer: the form state
   * below, and the payload the sheet writes. Computing it twice in two places
   * is how the screen and the record start disagreeing about what a type change
   * means.
   */
  const withType = (
    previous: ProfileFormValues,
    type: UserType,
  ): ProfileFormValues => ({
    ...previous,
    user_type: type,
    student_education_level:
      type === 'law_student' ? previous.student_education_level : null,
    /* PROFESSION IS CARRIED OVER, NOT EMPTIED.
       It used to blank here when a lawyer or a student moved to Other roles, so
       that the picker a third type opens "should not start out saying Lawyer".
       That reasoning holds on its own and it lost to a bigger rule today: the
       owner asked for a type change to stop deleting anything, and a blank sent
       for a field the record holds is a deletion whatever its motive. It shows
       the profession they had, they can change it, and switching back leaves it
       exactly as it was. */
    profession: previous.profession,
  });

  const chooseType = (type: UserType) => {
    // Changing the type changes which rows exist, so every message on screen is
    // now about a question that may no longer be asked.
    setErrors({});
    setValues((previous) => withType(previous, type));
  };

  /**
   * THE SHEET'S PICK IS THE SAVE, which is the owner's instruction of
   * 19 September 2026 and the reason Account type is a row rather than a block.
   *
   * ── THE PAYLOAD IS MEASURED AGAINST THE RECORD, NOT AGAINST THE SCREEN ────
   * `original` is what the server holds; `values` is that plus whatever is
   * being typed elsewhere on the page and has not been saved. Building this
   * write off `values` would post somebody's half-finished bio because they
   * changed their account type, which they never asked for. So the diff is
   * `original` with only the type change applied, and everything else on the
   * form stays unsaved and stays theirs.
   *
   * ── ONE TAP CAN EMPTY OTHER FIELDS, AND IT IS SUPPOSED TO ────────────────
   * `settleProfileValues` clears what the new type does not ask for: a lawyer
   * moving to Other roles loses law school, call to bar year, call number,
   * certifications, work experience, areas of expertise and profession. That is
   * the existing rule and the payload carries it, so the record and the screen
   * agree the moment the sheet closes. It is also why the caller may put a
   * question in front of this.
   */
  /**
   * ONE FIELD, WRITTEN ON ITS OWN. The owner, 20 September 2026: "I want each
   * input to have its own done button so that saves that particular one instead
   * of have a general save at the bottom that saves everything".
   *
   * `saveType` was the first of these and this is that function with the patch
   * made an argument, because every row now needs the same four properties:
   *
   *  - THE DIFF IS AGAINST THE RECORD, NOT THE SCREEN. `original` is what the
   *    server holds; `values` is that plus whatever else is half-typed on the
   *    page. Building the payload off `values` would post somebody's unfinished
   *    bio because they saved their name, which they never asked for.
   *  - WHAT THE PATCH IMPLIES TRAVELS WITH IT. `settleProfileValues` decides
   *    what a change means for the fields that hang off it, so a caller states
   *    the field it owns and nothing else.
   *  - A FAILED WRITE PUTS BACK ONLY WHAT IT TOUCHED. Every other field on the
   *    form is someone's unsaved typing and a failure here is no reason to take
   *    it.
   *  - THE ERROR LANDS ON THE FIELD. A 422 for the handle belongs under the
   *    handle, which is why `mutations.ts` carries `meta.silentError` and why
   *    this maps rather than toasting a whole-form message.
   */
  const commitField = (patch: Partial<ProfileFormValues>, what: string) => {
    const keys = Object.keys(patch) as (keyof ProfileFormValues)[];
    /* WHERE YOU STUDY IS CARRIED FROM THE SCREEN, NOT FROM THE RECORD.
       `student_education_level` is stored nowhere: the server has no field for
       it and it is inferred from which of `university` and `law_school` holds
       a value. So choosing it writes nothing, `original` never learns it, and
       a record built from `original` alone still says "not chosen". For a law
       student that hides University and Law school, and the scoping rule in
       `settleProfileValues` then drops the very answer being saved.

       The owner, 23 September 2026: "seems where you study and university
       doesnt actually save". Reproduced on lawexa.com the same night as a law
       student: Where you study -> University, then Lagos State University;
       the row showed it and no request was sent. Taking the answer on screen
       makes the university the thing that records it, which is the only way
       the backend can. */
    const nextRecord = settleProfileValues(
      {
        ...original,
        student_education_level: studyLevel,
        ...patch,
      },
      original,
    );
    const payload = buildProfilePayload(nextRecord, original);

    // On screen at once, so the row reads right while the write is in flight.
    setValues((current) => ({ ...current, ...patch }));
    setErrors((previous) => {
      const next = { ...previous };
      for (const key of keys) if (isAddressableField(key)) delete next[key];
      delete next.form;
      return next;
    });

    if (!hasChanges(payload)) return;

    saveProfile.mutate(payload, {
      onSuccess: () => {
        setOriginal(nextRecord);
        setValues((current) => settleProfileValues(current, nextRecord));
        toast.success(`${what} saved`);
      },
      onError: (error) => {
        /* BUILT AS A PATCH, NOT ASSIGNED KEY BY KEY. Writing
           `restored[key] = original[key]` over a union of keys narrows the
           target to `never`, because the compiler has to satisfy every member
           of the union at once. Collecting the same values into a partial and
           spreading it says the same thing and type-checks. */
        const revert = keys.reduce<Partial<ProfileFormValues>>(
          (acc, key) => ({ ...acc, [key]: original[key] }),
          {},
        );
        setValues((current) =>
          settleProfileValues({ ...current, ...revert }, original),
        );
        const apiError = extractApiError(error);
        const mapped = apiError.errors
          ? mapServerErrors(apiError.errors)
          : { fields: {}, matched: false };
        setErrors(mapped.matched ? mapped.fields : { form: apiError.message });
        toast.error(apiError.message);
      },
    });
  };

  const saveType = (type: UserType) => {
    const nextRecord = settleProfileValues(withType(original, type), original);
    const typePayload = buildProfilePayload(nextRecord, original);

    // The sheet closes itself once Done has handed the answer over, so there is
    // no `chooser.close()` here. Two closes in one frame is guarded inside the
    // hook rather than harmless by luck, and one owner of the closing is the
    // reason it never has to be.
    chooseType(type);

    if (!hasChanges(typePayload)) return;

    saveProfile.mutate(typePayload, {
      onSuccess: () => {
        // The baseline moves to what this write settled, so the sticky bar goes
        // back to counting only the edits that are still unsaved. Values are
        // SETTLED against the new baseline rather than replaced by it, for the
        // same reason the form's own save does it: a save that overlapped
        // somebody typing must keep their words.
        setOriginal(nextRecord);
        setValues((current) => settleProfileValues(current, nextRecord));
        toast.success('Account type saved');
      },
      onError: (error) => {
        /* BACK TO WHAT THE SERVER STILL HOLDS. The three keys the type change
           owns are put back from `original`, and `settleProfileValues` then
           recomputes everything that hangs off them. Other fields are somebody's
           unsaved typing, and a failed type change is no reason to take it.

           This matters more here than it does under the Save button. A failed
           save there leaves the value on screen next to the button that failed,
           so a reader can see both and press it again. By the time this runs the
           sheet has closed over the page, so a type left on screen that the
           record does not hold would sit there looking saved. */
        setValues((current) =>
          settleProfileValues(
            {
              ...current,
              user_type: original.user_type,
              student_education_level: original.student_education_level,
              profession: original.profession,
            },
            original,
          ),
        );
        const apiError = extractApiError(error);
        const mapped = apiError.errors
          ? mapServerErrors(apiError.errors)
          : { fields: {}, matched: false };
        setErrors(mapped.matched ? mapped.fields : { form: apiError.message });
        // A TOAST, because the sheet is shut and the form message it would
        // otherwise land in is at the bottom of a long page. The two are not
        // exclusive: the message is set above so the field still carries it.
        toast.error(apiError.message);
      },
    });
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

  /* What the Account type row shows, and what its icon is. An account that has
     never chosen one finds no entry here, and the row falls back to its
     placeholder rather than drawing a blank line where a value goes. */
  const accountType = ACCOUNT_TYPES.find(
    (option) => option.value === values.user_type,
  );

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
          {/* ── EVERY ROW OPENS, CHANGES, AND IS PRESSED DONE ──────────────
              The owner, 20 September 2026: "I want each input to have its own
              done button so that saves that particular one instead of have a
              general save at the bottom that saves everything".

              Gender was a select sitting on the page. A select has no Done and
              never can, and saving it the instant it changes is the invisible
              save he is objecting to — he wants to know when a change is kept.
              So it became a row like the rest. One rule for the screen, and no
              exception to explain. */}
          <SettingsPickerField
            icon={VenusAndMars}
            label="Gender"
            value={
              GENDERS.find((option) => option.value === values.gender)?.label ??
              null
            }
            placeholder="Not set"
            onOpen={() => chooser.show('gender')}
            error={errors.gender}
            disabled={saveProfile.isPending}
          />
          {/* DATE OF BIRTH KEEPS THE PLATFORM PICKER, it just keeps it inside a
              panel now. Tapping a date input opens the phone's own calendar
              either way; what changes is that the value it produces is kept by
              a Done rather than by a button at the bottom of the page. */}
          {textRow('date_of_birth')}
          {/* ── A ROW THAT OPENS A SHEET, NOT THREE ROWS ON THE PAGE ───────
              The owner, 19 September 2026: "it shows the setting then when you
              touch it, it then shows the modal with the option like in the
              screenshot and thats how it gets saved instead of selection one
              from the page and clicking save changes at the bottom".

              The three answers still exist, in `ChoicePanel`, drawn by the same
              row component that drew them here. What changed is where they live
              and when the write happens: the sheet's Done writes, which is why
              this is the only control on the screen whose value never reaches
              the Save button's diff.

              IT SITS IN THIS GROUP RATHER THAN ITS OWN, and the first build of
              it had its own. A group headed "Account type" above a row labelled
              "Account type" printed the same three words twice inside 60px.
              Every other single-row group here heads itself differently from
              its row ("Your work" over "Profession") and this one has no second
              name, so the heading was furniture. The sentence that was under
              that heading is the row's hint now, which also puts it next to the
              control it is about. */}
          <SettingsPickerField
            icon={accountType?.icon ?? Briefcase}
            label="Account type"
            value={accountType?.label ?? null}
            placeholder="Not set"
            hint="This decides which details the rest of this screen asks for."
            onOpen={() => chooser.show('account-type')}
            error={errors.user_type}
            disabled={saveProfile.isPending}
          />
        </SettingsFormGroup>


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
            {/* ── THE LAST INLINE CONTROL, AND IT LIVES HERE ─────────────
                "Where you study" was a choice group drawn onto the page. It
                survived my own count because that group renders labels in a
                div while I was counting list rows; @techleadclaude read it off
                the screenshot.

                IT IS IN THIS GROUP RATHER THAN ITS OWN. My first attempt gave
                it a section headed "Where you study" above a row labelled
                "Where you study", which is the same duplication I removed from
                Account type yesterday, rebuilt. It decides whether the rows
                below it ask for a university or a law school, so it belongs
                above them, inside the group it governs.

                ITS DONE SAVES `study_institution_type` since 23 September
                2026 (backend f512cac). Before that the answer was stored
                nowhere and inferred from which of `university` and
                `law_school` held a value, so it did not survive a reload, and
                a student with a university saved who chose Law school was read
                back as University. Profiles that have not answered since hold
                `null` and are still inferred. */}
            {visibility.showEducationLevelToggle && offersLawSchool ? (
              <SettingsPickerField
                icon={
                  STUDY_PLACES.find(
                    (o) => o.value === values.student_education_level,
                  )?.icon ?? School
                }
                label="Where you study"
                value={
                  STUDY_PLACES.find(
                    (o) => o.value === values.student_education_level,
                  )?.label ?? null
                }
                placeholder="Not set"
                onOpen={() => chooser.show('study-place')}
                disabled={saveProfile.isPending}
              />
            ) : null}
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
              <SettingsPickerField
                icon={GraduationCap}
                label="Level"
                value={
                  levelOptions.find((o) => o.value === values.level)?.label ??
                  null
                }
                placeholder="Not set"
                onOpen={() => chooser.show('level')}
                error={errors.level}
                disabled={saveProfile.isPending}
              />
            ) : null}
            {/* LAW SCHOOL IS FOR STUDENTS, NOT LAWYERS. The owner,
                20 September 2026: "ok remove for lawyer, keep for student".

                `showLawSchool` is `isLawyer || (isLawStudent && level ===
                'law_school')`, so it has always shown lawyers a field
                onboarding never asks them for: step 6 gates it on
                `isLawStudent ? level === 'law_school' : false`, which is
                literally `false` for a lawyer. Same fault as year of call, one
                row down, and I reported it to him as collected before reading
                that gate.

                SUBTRACTED HERE RATHER THAN FIXED IN THE FLAG. The honest change
                is to drop `isLawyer` from `showLawSchool` in
                `lib/utils/profile-field-config.ts`, and frozen v1 reads that
                same flag in `components/settings/education-info-form.tsx`.
                Editing it would silently remove the row from a v1 screen
                nobody asked us to touch. */}
            {visibility.showLawSchool && values.user_type !== 'lawyer' ? (
              <SettingsPickerField
                icon={Building2}
                label="Law school"
                value={values.law_school || null}
                placeholder="Not set"
                onOpen={() => chooser.show('law-school')}
                error={errors.law_school}
                disabled={saveProfile.isPending}
              />
            ) : null}
            {visibility.showCallNumber ? textRow('call_number') : null}
            {/* ── YEAR OF CALL, CERTIFICATIONS AND WORK EXPERIENCE ARE GONE ──
                The owner, 20 September 2026: "Those 3 not in onboarding remove
                them from the profile page".

                He asked which of these fields onboarding collects, and the
                answer was two of five. Law school is step 6 and required; call
                number is step 8 and required for lawyers. The other three are
                asked NOWHERE, and year of call was the strangest of them:
                `useOnboarding.ts` sends `call_to_bar_year` from a store value
                that no step ever writes, so the only way it could be filled was
                this screen.

                THE VALUES ARE NOT DELETED. The fields stay in
                `ProfileFormValues`, in the payload type and on the record; they
                simply have no control any more, so they never enter the diff.
                An account that already holds a call-to-bar year keeps it.

                `lib/utils/profile-field-config.ts` IS UNCHANGED ON PURPOSE. v1
                reads the same visibility flags in
                `components/settings/education-info-form.tsx`, and v1 is frozen
                (19 Sep: fix it only to stop harm to live users). Editing the
                shared config to tidy three unused flags would have changed a v1
                screen nobody asked us to touch. */}
          </SettingsFormGroup>
        ) : null}

        {visibility.showProfession || visibility.showAreasOfExpertise ? (
          <SettingsFormGroup id="work" label="Your work">
            {visibility.showProfession ? (
              <SettingsPickerField
                icon={Briefcase}
                label="Profession"
                value={professionLabel}
                placeholder="Not set"
                onOpen={() => chooser.show('profession')}
                error={errors.profession}
                disabled={saveProfile.isPending}
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

      {/* ── THE SAVE BAR IS GONE ────────────────────────────────────────
          The owner, 20 September 2026: "I dont like the save changes what
          shows. I dont like that flow thats why I want each input to have its
          own done button so that saves that particular one instead of have a
          general save at the bottom that saves everything."

          Every row on this screen now writes its own field when its Done is
          pressed, so there is no state left for a bar to report and no diff
          left for a button to send. It came out only once the last four
          controls had panels of their own; removing it earlier would have left
          gender, date of birth, level and profession with no way to save at
          all.

          A WHOLE-FORM ERROR HAS NOWHERE TO LAND NOW, and that is the reason
          `commitField` maps a 422 onto the field that caused it. A refusal the
          server does not attribute to a field still reaches the reader, as the
          toast that `commitField` raises beside it. */}

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
        /* DONE IS THE SAVE NOW. It used to call `set`, which put the value in
           the form and left it for the button at the bottom of the page. The
           owner asked for the opposite and was right that the old flow hides a
           trap: tapping Done, leaving the screen, and losing the change. */
        onCommit={(next) => {
          if (!heldField) return;
          commitField(
            { [heldField]: next } as Partial<ProfileFormValues>,
            PROFILE_TEXT_FIELDS[heldField].label,
          );
        }}
      />

      {/* THE ONLY OVERLAY ON THIS SCREEN THAT WRITES. The other three hand a
          value back to the form and the page's Save button carries it; this one
          posts when its own Done is pressed, which is why `saveType` and not
          `chooseType` is wired to it. */}
      <ChoicePanel
        {...chooser.bind('account-type')}
        title="Account type"
        description="This decides which details the rest of this screen asks for."
        name="profile-account-type"
        value={values.user_type}
        options={ACCOUNT_TYPES}
        onChoose={saveType}
        busy={saveProfile.isPending}
      />

      {/* THE THREE THAT WERE SELECTS. Each is a short fixed list with one
          answer, which is what `ChoicePanel` is, and each writes its own field
          on Done. Their rows are `SettingsPickerField` like every other row, so
          the screen has one shape and one rule. */}
      {/* Two answers, and choosing one decides whether the next row asks for a
          university or a law school. It saves `study_institution_type`; see
          the row for why that field exists. */}
      <ChoicePanel
        {...chooser.bind('study-place')}
        title="Where you study"
        name="profile-study-place"
        value={values.student_education_level ?? ''}
        options={STUDY_PLACES}
        onChoose={(value) =>
          commitField({ student_education_level: value }, 'Where you study')
        }
        busy={saveProfile.isPending}
      />

      <ChoicePanel
        {...chooser.bind('gender')}
        title="Gender"
        name="profile-gender"
        value={values.gender}
        options={GENDERS}
        onChoose={(value) => commitField({ gender: value }, 'Gender')}
        busy={saveProfile.isPending}
      />

      {/* THE SERVED LIST, IN A SEARCHABLE SHEET. The owner, 22 September
          2026: "The profession list should be populated with a decent number
          of profession especially the ones that need lawyers or legal
          assistants ... Should it be on the API ... when others is selected it
          should allow the person type it in". Backend serves 38 rows plus
          Other from `GET /professions`; the SLUG is saved (see `Profession`),
          and Other opens a box whose text is saved instead. */}
      <OptionPicker
        {...chooser.bind('profession')}
        title="Profession"
        searchLabel="Search professions"
        searchPlaceholder="Search professions"
        options={professionOptions}
        isLoading={professionsQuery.isPending}
        selected={values.profession ? [values.profession] : []}
        emptyMessage={
          professionsQuery.isError
            ? 'The profession list could not be loaded. Try again shortly.'
            : 'No profession matches that.'
        }
        otherId={otherProfessionSlug}
        otherLabel="What is your profession?"
        onChange={(ids) => commitField({ profession: ids[0] ?? '' }, 'Profession')}
        busy={saveProfile.isPending}
      />

      {/* THE LEVEL LIST IS COUNTRY-SHAPED. "300 Level" in Nigeria, "Junior" in
          the United States, and a stored level that falls outside the current
          country's list is added back rather than dropped, which the list this
          reads already does. */}
      <ChoicePanel
        {...chooser.bind('level')}
        title="Level"
        name="profile-level"
        value={values.level}
        options={levelOptions}
        onChoose={(value) => commitField({ level: value }, 'Level')}
        busy={saveProfile.isPending}
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
        /* WHICH EMPTY IS THIS. "No country matches that" is only true after a
           search. Said to somebody who has typed nothing, it reports a failed
           search that never happened — and on 21 September 2026 that is what
           the screen said to everyone, because the list's provider had died and
           the list arrived empty. The reader was told their search found
           nothing when there was nothing to search. Same treatment as the
           University row below. */
        emptyMessage={
          countriesQuery.isError
            ? 'The country list could not be loaded. Try again shortly.'
            : countryOptions.length === 0
              ? 'The country list is unavailable right now.'
              : 'No country matches that.'
        }
        onChange={(ids) => commitField({ country: ids[0] ?? '' }, 'Country')}
        busy={saveProfile.isPending}
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
        onChange={(ids) => commitField({ university: ids[0] ?? '' }, 'University')}
        busy={saveProfile.isPending}
      />

      <OptionPicker
        {...chooser.bind('law-school')}
        title="Where did you attend law school?"
        searchLabel="Search law schools"
        searchPlaceholder="Search law schools"
        options={lawSchoolOptions}
        isLoading={lawSchoolsQuery.isPending}
        selected={values.law_school ? [values.law_school] : []}
        emptyMessage={
          lawSchoolsQuery.isError
            ? 'The law school list could not be loaded. Try again shortly.'
            : 'No law school matches that.'
        }
        onChange={(ids) => commitField({ law_school: ids[0] ?? '' }, 'Law school')}
        busy={saveProfile.isPending}
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
          commitField(
            { areas_of_expertise: ids.map(Number).filter(Number.isInteger) },
            'Areas of expertise',
          )
        }
        busy={saveProfile.isPending}
      />
    </form>
  );
}
