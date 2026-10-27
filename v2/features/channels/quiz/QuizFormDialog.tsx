'use client';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  FileMinus,
  FilePlus,
  FileText,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { extractApiError } from '@/lib/utils/api-error';
import type {
  ChannelQuiz,
  ChannelQuizResponse,
  ChannelQuizSettings,
  ChannelQuizVisibility,
  QuizQuestionType,
} from '@/types/channel-quiz';
import {
  QUIZ_LEVELS,
  QUIZ_TOPIC_MAX_LENGTH,
  quizMaxYear,
  readQuizYear,
} from '@/v2/features/quiz/solo/home-model';
import { canPublishPublicly } from '@/v2/features/quiz/solo/model';
import { useBackGuard } from '@/v2/runtime/use-back-guard';
import { useV2Session } from '@/v2/runtime/session-context';
import { useCreateLibraryQuiz, useCreateQuiz, useUpdateQuiz } from './mutations';
import { channelQuizQueries } from './queries';
import {
  addToScenario,
  canMoveOutOfScenario,
  canMoveQuestion,
  canMoveScenario,
  draftsFromQuiz,
  duplicateQuestion,
  findFormProblem,
  groupQuestions,
  insertQuestionAfter,
  moveIntoScenario,
  moveOutOfScenario,
  moveQuestion,
  moveScenario,
  newOption,
  newQuestion,
  newScenario,
  QUIZ_SCENARIO_PASSAGE_MAX,
  QUIZ_SCENARIO_TITLE_MAX,
  quizSaveConflict,
  toPayload,
  trueFalseOptions,
  type FormProblemTarget,
  type MoveDirection,
  type QuestionDraft,
  type ScenarioDraft,
  hasFormContent,
} from './form-model';
import {
  optionLetter,
  PUBLIC_NEEDS_VERIFIED_AUTHOR,
  QUIZ_DEFAULT_SETTINGS,
  QUIZ_DESCRIPTION_MAX,
  QUIZ_EXPLANATION_MAX,
  QUIZ_MAX_OPTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_OPTION_MAX,
  QUIZ_QUESTION_MAX,
  QUIZ_SECOND_CHOICES,
  QUIZ_TITLE_MAX,
  quizHasRoom,
  visibilityChoicesFor,
} from './model';
import { VISIBILITY_MARKS } from './VisibilityChip';
import { QuizSourceLine } from '@/v2/features/quiz/source/QuizSourceLine';
import '@/v2/features/quiz/solo/solo-quiz.css';

/**
 * QuizFormDialog — write a quiz, or edit one that hasn't been played.
 *
 * Phase-5 W6; rules from `docs/api/channel-quiz.md` (backend repo): at least
 * one question (the 20-question cap went with the solo quiz, 2026-10-21) ·
 * 2–4 options with exactly one correct · `true_false` is exactly two · 5–60
 * second timers. Every one of them is checked here as well as server-side,
 * because a validation error that costs a round trip on question seventeen is
 * a bad way to learn about question three.
 *
 * ── WHO CAN FIND IT IS CHOSEN HERE TOO (2026-10-21) ─────────────────────────
 * The four visibilities (`visibilityChoicesFor`: `shared` only where a room is
 * in the picture) as the sharing feature's choice cards, owner only on an
 * edit. A new quiz for a channel opens on `shared`, the server's default; one
 * for the library on `private`. "Everyone" is drawn disabled with its reason
 * for an author the session has not verified, and when the server refuses a
 * public save anyway (`403`, a stale snapshot) the same sentence appears under
 * the cards and the form stays open on the choice, so the reader picks
 * another and saves again — a refusal, never a lost draft.
 *
 * A DIALOG, NOT A BUILDER SCREEN (the brief's "keep authoring lean"). A quiz
 * here is a handful of questions written between messages — it is not a course
 * authoring tool, and giving it its own route would imply otherwise. The form
 * is one scrollable column of question cards with the four controls each needs.
 *
 * THE PLAYED-QUIZ GAP, HANDLED HONESTLY. The backend freezes a quiz's
 * QUESTIONS once real plays exist (`409`) while leaving its title, description
 * and settings editable, and the planned escape hatch — duplicate-as-draft —
 * does not exist yet (digest §E, "known gaps"). So an edit that touches
 * questions and comes back 409 is not reported as a failure: the form says
 * what the rule is and offers the save that WILL work, one press away.
 *
 * ── WHERE A NEW QUIZ LANDS (2026-08-05) ────────────────────────────────────
 * A quiz can now be written FOR a channel (`POST /channels/{c}/quizzes`, which
 * stamps that channel as its provenance) or straight into the author's LIBRARY
 * (`POST /channel-quizzes`, provenance `null`). Both run the same way — a game
 * always names the room it is starting in — so the difference is one of
 * belonging, not of capability.
 *
 * THE CHOICE IS THE TAB THE READER OPENED THE FORM FROM, not a checkbox in it.
 * The sheet asks the question already ("In this channel" or "My library"), the
 * answer is visible while they write, and the dialog states the consequence in
 * one line under the title rather than offering a second, silent control that
 * would only be able to contradict the first. Editing has no destination at
 * all — a quiz's home is fixed once it exists.
 *
 * ── IT OPENS OUTSIDE A CHANNEL TOO (2026-10-21) ─────────────────────────────
 * The library page (`/quiz/library`) writes quizzes with no room anywhere in
 * sight, so `channelUuid` and `channelName` are optional and a form with
 * neither can only file into the library: `destination` is read only when
 * there is a channel to file into.
 *
 * ── SCENARIOS, IN THE LIBRARY'S FORM (quiz piece 4, 23 October 2026) ───────
 * A quiz written outside a channel can share a passage between questions: a
 * blue scenario card holds its title (optional) and its passage, with its
 * questions inside it, and "Add a scenario" sits beside "Add a question". The
 * drafts and their rules are `form-model.ts`. The two game switches (the
 * leaderboard, late joiners) belong to a channel game, so the library's form
 * leaves them out and the quiz keeps their defaults (picture 6). A channel's
 * form keeps them, and no scenario box: a game does not show passages yet.
 *
 * ── ARTHUR'S REDESIGN, PART A (25 October 2026; built 27 October) ──────────
 * One short line in place of the introduction. The form reads title and
 * description, then the questions, then "Who can access this quiz?" as one
 * compact selector, with a channel game's switches folded under "Game
 * settings". A question card has one compact row for its number, type and
 * timer, the question box as its focus, answers whose correct one carries a
 * tick, and "Explanation (optional)" below them. A refused save scrolls to
 * the title, question or scenario at fault and says why there
 * (`findFormProblem`), and keeps saying so until it is fixed.
 */

/** Where a NEW quiz is filed. Ignored when editing — a quiz's home is fixed. */
export type QuizDestination = 'channel' | 'library';

/** The level choice's "none", which a Radix item cannot hold as an empty value. */
const NO_LEVEL = '__none';

export function QuizFormDialog({
  open,
  onOpenChange,
  channelUuid,
  channelName,
  destination = 'library',
  viewerId,
  quizUuid,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The room a new quiz may be written FOR. Absent outside a channel. */
  channelUuid?: string;
  /** Named in the destination line, so "this channel" is never abstract. */
  channelName?: string;
  /** Read only when there is a channel; with none, the library is the only
   *  place a quiz can go. */
  destination?: QuizDestination;
  viewerId: number | null;
  /** Present = edit an existing quiz; absent = write a new one. */
  quizUuid?: string;
  onSaved?: (quiz: ChannelQuiz) => void;
}) {
  const isEdit = !!quizUuid;
  const detailQuery = useQuery({
    ...channelQuizQueries.quizDetail(quizUuid ?? '', { viewerId }),
    enabled: open && isEdit,
  });
  const loaded = detailQuery.data?.data ?? null;

  // Where a NEW quiz lands. A room to file into, and the tab that asked for
  // it; otherwise the library, which is the only answer there is.
  const room =
    channelUuid !== undefined && destination === 'channel'
      ? { uuid: channelUuid, name: channelName ?? 'this channel' }
      : null;

  const createQuiz = useCreateQuiz();
  const createLibraryQuiz = useCreateLibraryQuiz();
  const updateQuiz = useUpdateQuiz(quizUuid ?? '');
  const canPublish = canPublishPublicly(useV2Session());

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // What the quiz lists filter by (Arthur's quiz list, part 5): each optional.
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const [yearText, setYearText] = useState('');
  /** Read once per opening: the dialog is keyed per opening. */
  const [maxYear] = useState(() => quizMaxYear(new Date()));
  const [yearProblem, setYearProblem] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChannelQuizSettings>(
    QUIZ_DEFAULT_SETTINGS,
  );
  // The server's default for a room, the quiz's own for a library — see the
  // docblock. `room` is fixed for this mount (the dialog is keyed per opening).
  const [visibility, setVisibility] = useState<ChannelQuizVisibility>(
    room ? 'shared' : 'private',
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => [
    newQuestion(),
  ]);
  const [scenarios, setScenarios] = useState<ScenarioDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Set when the server refuses a question change on a played quiz. */
  const [frozen, setFrozen] = useState(false);
  /** Set when the server refuses `public` for this author (a stale snapshot
   *  said otherwise). Cleared by choosing again. */
  const [publicRefused, setPublicRefused] = useState(false);
  /** A save was refused for a gap in the form: from then on the gap is said
   *  where it is, live, until it is filled (`findFormProblem`). */
  const [checking, setChecking] = useState(false);

  // Adopt the loaded quiz ONCE, in render (the sanctioned adjust-on-prop-change
  // pattern) — an effect would paint one frame of an empty form over a quiz the
  // author asked to edit.
  const [adopted, setAdopted] = useState<string | null>(null);
  if (loaded && adopted !== loaded.uuid) {
    setAdopted(loaded.uuid);
    setTitle(loaded.title);
    setDescription(loaded.description ?? '');
    setTopic(loaded.topic ?? '');
    setLevel(loaded.level ?? null);
    setYearText(loaded.year ? String(loaded.year) : '');
    setSettings({ ...QUIZ_DEFAULT_SETTINGS, ...loaded.settings });
    setVisibility(loaded.visibility);
    const drafts = draftsFromQuiz(loaded);
    setQuestions(drafts.questions);
    setScenarios(drafts.scenarios);
    setFrozen(false);
    setPublicRefused(false);
  }

  const submitting =
    createQuiz.isPending || createLibraryQuiz.isPending || updateQuiz.isPending;
  /** The server only sends `is_correct` to viewers it will let edit. No flag
   *  anywhere ⇒ this reader may not rewrite the questions. */
  const mayEditQuestions =
    !isEdit ||
    !loaded ||
    (loaded.questions ?? []).some((question) =>
      question.options.some((option) => option.is_correct !== undefined),
    );
  /** Who can find a quiz is its OWNER's to say (a channel admin editing a
   *  quiz born in their room may change its title, never its visibility). */
  const mayEditVisibility = !isEdit || loaded?.is_mine === true;
  /** `shared` is offered only where a room is in the picture. */
  const inRoom = room !== null || (loaded !== null && quizHasRoom(loaded));
  const visibilityChoices = visibilityChoicesFor(inRoom);
  /** The library's form: scenarios on, the channel game's switches off. Opened
   *  from a channel (even to edit a library quiz there) it keeps the switches,
   *  so a quiz's leaderboard and late-joiner choice can always be changed
   *  somewhere: a game takes them from the quiz, and going live sends only the
   *  room (`goLive`). */
  const solo = !inRoom && channelUuid === undefined;
  const groups = groupQuestions(questions, scenarios);
  /** Each scenario's number, as its card says it ("Scenario 2"). */
  const scenarioNumbers = groups
    .flatMap((group) => (group.kind === 'scenario' ? [group.scenario.key] : []))
    .map((key, index) => ({ key, number: index + 1 }));
  /** Saving title and settings alone (a played quiz, or not this viewer's
   *  questions) checks only the title: the questions are not its business. */
  const metadataOnly = frozen || !mayEditQuestions;
  const problem = !checking
    ? null
    : metadataOnly
      ? title.trim()
        ? null
        : { message: 'Give the quiz a title.', target: { kind: 'title' as const } }
      : findFormProblem(title, questions, scenarios);
  const titleProblem = problem?.target?.kind === 'title' ? problem.message : null;
  const problemAt = (target: FormProblemTarget['kind'], key: string): string | null =>
    problem?.target && problem.target.kind === target && 'key' in problem.target && problem.target.key === key
      ? problem.message
      : null;
  const chosenVisibility = visibilityChoices.find((choice) => choice.id === visibility) ?? visibilityChoices[0];

  // DISCARD CHANGES? (Stay, 23 October 2026). A NEW quiz with anything in it
  // asks before it is thrown away, however the reader tries to leave: Cancel,
  // Escape, a tap outside, or the device's Back. An empty form, and an edit
  // (its saved copy is still there), close at once.
  const dirty = !isEdit && hasFormContent({ title, description, questions, scenarios });
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // The device's Back asks too: while there is something to lose, Back takes
  // one extra step that leaves the form where it is, and the question shows.
  const backGuard = useBackGuard(open && dirty, () => setConfirmDiscard(true));
  const close = () => backGuard.release(() => onOpenChange(false));
  const requestClose = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (dirty && !submitting) setConfirmDiscard(true);
    else close();
  };
  // Set by Discard, whose tap also closes the question: that close is not
  // "Keep editing" and must not put the extra Back step back.
  const discardingRef = useRef(false);
  const onConfirmDiscardChange = (next: boolean) => {
    setConfirmDiscard(next);
    // Keep editing: Back asks again next time.
    if (!next && !discardingRef.current) backGuard.rearm();
  };

  const updateScenario = (key: string, patch: Partial<ScenarioDraft>) => {
    setScenarios((prev) => prev.map((scenario) => (scenario.key === key ? { ...scenario, ...patch } : scenario)));
  };
  /** A new scenario arrives with its first question, at the end of the list. */
  const addScenario = () => {
    const scenario = newScenario();
    setScenarios((prev) => [...prev, scenario]);
    setQuestions((prev) => [...prev, newQuestion(scenario.key)]);
  };
  /** Removing a scenario keeps its questions, as questions on their own. */
  const removeScenario = (key: string) => {
    setScenarios((prev) => prev.filter((scenario) => scenario.key !== key));
    setQuestions((prev) => prev.map((question) => (question.scenarioKey === key ? { ...question, scenarioKey: null } : question)));
  };

  const updateQuestion = (key: string, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.key === key ? { ...question, ...patch } : question,
      ),
    );
  };

  const setType = (key: string, type: QuizQuestionType) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.key !== key) return question;
        if (type === 'true_false') {
          const options = trueFalseOptions();
          return { ...question, type, options, correctKey: options[0].key };
        }
        return {
          ...question,
          type,
          options: [newOption(), newOption()],
          correctKey: null,
        };
      }),
    );
  };

  /** The title, question or scenario a refused save is about, brought into view. */
  const scrollToProblem = (target: FormProblemTarget | null) => {
    const id = !target ? 'quiz-questions' : target.kind === 'title' ? 'quiz-title' : `quiz-${target.kind}-${target.key}`;
    const element = document.getElementById(id);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element?.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    if (target?.kind === 'title') element?.focus({ preventScroll: true });
  };

  const handleSubmit = () => {
    setError(null);
    // A metadata-only save (the played-quiz path) still needs a title — the
    // questions it cannot touch are not its business.
    const found = metadataOnly
      ? title.trim()
        ? null
        : { message: 'Give the quiz a title.', target: { kind: 'title' as const } }
      : findFormProblem(title, questions, scenarios);
    if (found) {
      setChecking(true);
      scrollToProblem(found.target);
      return;
    }
    const { year, problem: badYear } = readQuizYear(yearText, maxYear);
    if (badYear) {
      setYearProblem(badYear);
      document.getElementById('quiz-year')?.focus();
      return;
    }
    // Sent as `null` when empty, so an edit can clear what was set.
    const about = { topic: topic.trim() || null, level, year };

    const onError = (mutationError: Error) => {
      const { status, message, errors } = extractApiError(mutationError);
      // A 409 is a freeze only when the server says the questions were played;
      // a live game or a question in use passes, so its sentence shows and the
      // edits stay for the next save (`quizSaveConflict`).
      const reason = (errors as Record<string, unknown> | null)?.reason;
      if (status === 409 && !metadataOnly && quizSaveConflict(reason) === 'frozen') {
        // The documented freeze — not a failure, a rule.
        setFrozen(true);
        setError(null);
        return;
      }
      if (status === 403 && mayEditVisibility && visibility === 'public') {
        // "Everyone" is for verified authors — a rule, said under the choice,
        // with the draft kept and the form open.
        setPublicRefused(true);
        setError(null);
        return;
      }
      setError(message);
    };

    if (isEdit) {
      updateQuiz.mutate(
        {
          title: title.trim(),
          description: description.trim() || undefined,
          ...about,
          settings,
          visibility: mayEditVisibility ? visibility : undefined,
          ...(metadataOnly || !mayEditQuestions ? {} : toPayload(questions, scenarios)),
        },
        {
          onSuccess: (response) => {
            close();
            onSaved?.(response.data);
          },
          onError,
        },
      );
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      ...about,
      visibility,
      settings,
      ...toPayload(questions, scenarios),
    };
    const onCreated = {
      onSuccess: (response: ChannelQuizResponse) => {
        close();
        onSaved?.(response.data);
      },
      onError,
    };
    if (room) createQuiz.mutate({ channelUuid: room.uuid, payload }, onCreated);
    else createLibraryQuiz.mutate(payload, onCreated);
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={requestClose}
      className="md:max-w-2xl"
      title={
        isEdit
          ? 'Edit quiz'
          : room
            ? `New quiz in ${room.name}`
            : 'New quiz in your library'
      }
      description={
        <>
          {/* One short line (Arthur, 25 October 2026: "replace the long
              introductory content with a short description"). A channel's
              keeps the live game's own fact. */}
          {solo
            ? 'Each question has its own timer, and faster right answers score more.'
            : 'Each question has its own timer. Everyone answers on their own device.'}
          {/* THE CONSEQUENCE, STATED — a channel's new quiz only, while it is
              still a choice. It is a `span` and not a `p` because
              `DialogDescription` IS a paragraph, and a paragraph inside a
              paragraph is markup the browser silently rewrites. */}
          {!isEdit && room ? (
            <span className="mt-1 block text-xs">
              It belongs to {room.name} and to you, and it is in your library either way.
            </span>
          ) : null}
        </>
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => requestClose(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          {/* A quiz whose questions are frozen (played) or not this viewer's to
              rewrite saves its METADATA — and validating questions it cannot
              touch would lock the reader out of the save that does work. */}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {metadataOnly
              ? 'Save title and settings'
              : isEdit
                ? 'Save changes'
                : 'Create quiz'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {isEdit && detailQuery.isPending ? (
          <QuizFormSkeleton />
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="quiz-title">Title</Label>
              <Input
                id="quiz-title"
                maxLength={QUIZ_TITLE_MAX}
                placeholder="e.g. Land law, week 4"
                value={title}
                aria-invalid={titleProblem ? true : undefined}
                aria-describedby={titleProblem ? 'quiz-title-problem' : undefined}
                onChange={(event) => setTitle(event.target.value)}
              />
              {titleProblem ? <FormProblemLine id="quiz-title-problem">{titleProblem}</FormProblemLine> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quiz-description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="quiz-description"
                maxLength={QUIZ_DESCRIPTION_MAX}
                rows={2}
                placeholder="What is this quiz for?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {/* What the quiz is about, so it can be found by it (Arthur's
                quiz list, part 5). All three optional; the level list and
                free-text topic wait on Stay, so both come from one place
                (`home-model.ts`). */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                Topic, level and year <span className="font-normal text-muted-foreground">(optional)</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_7rem]">
                <Input
                  id="quiz-topic"
                  aria-label="Topic"
                  className="col-span-2 sm:col-span-1"
                  maxLength={QUIZ_TOPIC_MAX_LENGTH}
                  placeholder="Topic, e.g. Land Law"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                />
                <Select
                  value={level ?? NO_LEVEL}
                  onValueChange={(next) => setLevel(next === NO_LEVEL ? null : next)}
                >
                  <SelectTrigger id="quiz-level" aria-label="Level" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-w-[min(18rem,calc(100vw-2rem))]">
                    <SelectItem value={NO_LEVEL}>Any level</SelectItem>
                    {QUIZ_LEVELS.map((choice) => (
                      <SelectItem key={choice} value={choice}>
                        {choice}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="quiz-year"
                  aria-label="Year"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="Year"
                  value={yearText}
                  aria-invalid={yearProblem ? true : undefined}
                  aria-describedby={yearProblem ? 'quiz-year-problem' : undefined}
                  onChange={(event) => {
                    setYearText(event.target.value.replace(/\D/g, ''));
                    setYearProblem(null);
                  }}
                />
              </div>
              {yearProblem ? <FormProblemLine id="quiz-year-problem">{yearProblem}</FormProblemLine> : null}
            </fieldset>

            {!mayEditQuestions && (
              <p className="rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                You can change this quiz&rsquo;s title, description and
                settings. Its questions belong to its author.
              </p>
            )}

            {frozen && (
              <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
                This quiz has already been played, so its questions are locked:
                scores would stop meaning anything if they could change
                underneath. The title, description and settings can still be
                saved. To change the questions, write a new quiz.
              </p>
            )}

            {mayEditQuestions && !frozen && (
              <div id="quiz-questions" className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Questions{' '}
                  <span className="font-normal tabular-nums text-muted-foreground">
                    · {questions.length}
                  </span>
                </p>
                {problem && problem.target === null ? <FormProblemLine>{problem.message}</FormProblemLine> : null}
                {/* A longer quiz gets a row of its question numbers to jump by
                    (Arthur: "navigate longer quizzes without excessive
                    scrolling"); it stays in view as the form scrolls. */}
                {questions.length >= QUESTION_JUMP_FROM ? (
                  <QuestionJump
                    questions={questions}
                    problemKey={problem?.target?.kind === 'question' ? problem.target.key : null}
                  />
                ) : null}
                {groups.map((group) => {
                  const card = (question: QuestionDraft, index: number) => (
                    <div key={question.key} className="space-y-1">
                      <QuestionCard
                        index={index}
                        draft={question}
                        inScenario={group.kind === 'scenario'}
                        problem={problemAt('question', question.key)}
                        onChange={(patch) => updateQuestion(question.key, patch)}
                        onChangeType={(type) => setType(question.key, type)}
                        menu={{
                          canMoveUp: canMoveQuestion(questions, question.key, 'up'),
                          canMoveDown: canMoveQuestion(questions, question.key, 'down'),
                          onMove: (direction) => setQuestions((prev) => [...moveQuestion(prev, question.key, direction)]),
                          onDuplicate: () => setQuestions((prev) => duplicateQuestion(prev, question.key)),
                          intoScenarios: question.scenarioKey === null && solo ? scenarioNumbers : [],
                          onMoveInto: (scenarioKey) => setQuestions((prev) => moveIntoScenario(prev, question.key, scenarioKey)),
                          canMoveOut: question.scenarioKey === null ? null : canMoveOutOfScenario(questions, question.key),
                          onMoveOut: () => setQuestions((prev) => moveOutOfScenario(prev, question.key)),
                          canRemove: questions.length > 1,
                          onRemove: () => setQuestions((prev) => prev.filter((entry) => entry.key !== question.key)),
                        }}
                      />
                      {/* "Add question" after each question (Arthur, point 5);
                          the last one has the buttons below the list. */}
                      {index < questions.length - 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => setQuestions((prev) => insertQuestionAfter(prev, question.key))}
                        >
                          <Plus aria-hidden className="size-3.5" />
                          Add a question below
                        </Button>
                      ) : null}
                    </div>
                  );
                  if (group.kind === 'question') return card(group.question, group.start);
                  const number = scenarioNumbers.find((entry) => entry.key === group.scenario.key)?.number ?? 1;
                  return (
                    <ScenarioCard
                      key={group.scenario.key}
                      number={number}
                      draft={group.scenario}
                      problem={problemAt('scenario', group.scenario.key)}
                      canMoveUp={canMoveScenario(questions, group.scenario.key, 'up')}
                      canMoveDown={canMoveScenario(questions, group.scenario.key, 'down')}
                      onMove={(direction) => setQuestions((prev) => [...moveScenario(prev, group.scenario.key, direction)])}
                      onChange={(patch) => updateScenario(group.scenario.key, patch)}
                      onRemove={() => removeScenario(group.scenario.key)}
                      onAddQuestion={() => setQuestions((prev) => addToScenario(prev, group.scenario.key))}
                    >
                      {group.questions.map((question, offset) => card(question, group.start + offset))}
                    </ScenarioCard>
                  );
                })}

                <div className={cn('grid gap-2', solo && 'sm:grid-cols-2')}>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      setQuestions((prev) => [...prev, newQuestion()])
                    }
                  >
                    <Plus aria-hidden className="size-4" />
                    Add a question
                  </Button>
                  {solo && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-[oklch(0.62_0.17_255/0.55)]"
                      onClick={addScenario}
                    >
                      <FileText aria-hidden className="size-4" />
                      Add a scenario
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* WHO CAN ACCESS THIS QUIZ? (Arthur, 25 October 2026): one
                compact selector after the questions, each choice explained in
                a line, "Everyone" for verified authors only, as the server
                rules. The trigger names the choice; its line sits under it. */}
            {mayEditVisibility && (
              <div className="space-y-1.5">
                <Label id="quiz-visibility-label" htmlFor="quiz-visibility">
                  Who can access this quiz?
                </Label>
                <Select
                  value={visibility}
                  onValueChange={(value) => {
                    setVisibility(value as ChannelQuizVisibility);
                    setPublicRefused(false);
                  }}
                >
                  <SelectTrigger
                    id="quiz-visibility"
                    aria-labelledby="quiz-visibility-label"
                    aria-describedby="quiz-visibility-hint"
                    className="h-10 w-full sm:w-72"
                  >
                    <SelectValue>
                      <span className="flex items-center gap-2">
                        <VisibilityMark id={chosenVisibility.id} />
                        {chosenVisibility.label}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  {/* Below the trigger and no wider than the screen allows, so
                      the question it answers stays in sight and a phone shows
                      each line whole. */}
                  <SelectContent
                    position="popper"
                    align="start"
                    className="w-[min(24rem,calc(100vw-2rem))]"
                  >
                    {visibilityChoices.map((choice) => {
                      const locked = choice.needsVerifiedAuthor && !canPublish;
                      return (
                        <SelectItem key={choice.id} value={choice.id} disabled={locked}>
                          <span className="flex items-start gap-2.5 py-0.5">
                            <VisibilityMark id={choice.id} className="mt-0.5" />
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium">{choice.label}</span>
                              <span className="text-xs text-muted-foreground">
                                {locked ? PUBLIC_NEEDS_VERIFIED_AUTHOR : choice.hint}
                              </span>
                            </span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p id="quiz-visibility-hint" className="text-xs text-muted-foreground">
                  {chosenVisibility.hint}
                </p>
                {publicRefused && (
                  <p
                    role="alert"
                    className="text-sm text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
                  >
                    {PUBLIC_NEEDS_VERIFIED_AUTHOR} Choose another option, then
                    save again.
                  </p>
                )}
              </div>
            )}

            {/* A channel game's two switches, folded away ("keep advanced
                settings collapsible"); a quiz taken alone has none. */}
            {!solo && (
              <Collapsible className="rounded-lg border">
                <CollapsibleTrigger className="group/settings v2-interactive flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-foreground">
                  Game settings
                  <ChevronDown
                    aria-hidden
                    className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]/settings:rotate-180 motion-reduce:transition-none"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 px-3 pb-3">
                  <SettingRow
                    id="quiz-leaderboard"
                    label="Show the leaderboard between questions"
                    hint="Off keeps the scores a surprise until the podium."
                    checked={settings.show_leaderboard}
                    onChange={(value) =>
                      setSettings((prev) => ({ ...prev, show_leaderboard: value }))
                    }
                  />
                  <SettingRow
                    id="quiz-late-join"
                    label="Let people join after it starts"
                    hint="Late joiners play from the next question."
                    checked={settings.allow_late_join}
                    onChange={(value) =>
                      setSettings((prev) => ({ ...prev, allow_late_join: value }))
                    }
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* `role="alert"`: a screen reader is told the moment the save is
                refused, not only a reader who can see the red line. */}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </>
        )}
      </div>
      <AlertDialog open={confirmDiscard} onOpenChange={onConfirmDiscardChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This quiz has not been saved. Discarding it throws away what you have written.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                discardingRef.current = true;
                setConfirmDiscard(false);
                close();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveOverlay>
  );
}

function SettingRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** From this many questions the form shows a row of their numbers to jump by. */
const QUESTION_JUMP_FROM = 4;

/**
 * The question numbers in a row that stays at the top of the form as it
 * scrolls: a tap brings that question into view. The one a refused save is
 * about is marked.
 */
function QuestionJump({ questions, problemKey }: { questions: readonly QuestionDraft[]; problemKey: string | null }) {
  const jump = (key: string) => {
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`quiz-question-${key}`)?.scrollIntoView({ block: 'start', behavior: still ? 'auto' : 'smooth' });
  };
  return (
    <nav
      aria-label="Jump to a question"
      // The overlay's own surface (`bg-popover`), solid, so the text scrolling under it never shows through.
      className="sticky top-0 z-10 -mx-1 border-b border-border/60 bg-popover px-1 py-1.5"
    >
      <ol className="flex flex-wrap gap-1.5">
        {questions.map((question, index) => (
          <li key={question.key}>
            <button
              type="button"
              onClick={() => jump(question.key)}
              aria-label={`Go to question ${index + 1}${question.key === problemKey ? ', needs attention' : ''}`}
              className={cn(
                'v2-interactive grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-xs font-semibold tabular-nums transition-colors',
                question.key === problemKey
                  ? 'bg-destructive/12 text-destructive ring-1 ring-destructive/50'
                  : 'bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {index + 1}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

interface QuestionMenuActions {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: MoveDirection) => void;
  onDuplicate: () => void;
  /** The scenarios a question on its own can join; empty where there are none. */
  intoScenarios: readonly { key: string; number: number }[];
  onMoveInto: (scenarioKey: string) => void;
  /** `null` for a question on its own; `false` for a scenario's only question. */
  canMoveOut: boolean | null;
  onMoveOut: () => void;
  canRemove: boolean;
  onRemove: () => void;
}

/** A question's "⋯": move up or down, duplicate, into or out of a scenario, remove. */
function QuestionMenu({ number, menu }: { number: number; menu: QuestionMenuActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          aria-label={`Question ${number} options`}
        >
          <MoreHorizontal aria-hidden className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem disabled={!menu.canMoveUp} onSelect={() => menu.onMove('up')}>
          <ArrowUp aria-hidden className="size-4" />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!menu.canMoveDown} onSelect={() => menu.onMove('down')}>
          <ArrowDown aria-hidden className="size-4" />
          Move down
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={menu.onDuplicate}>
          <Copy aria-hidden className="size-4" />
          Duplicate
        </DropdownMenuItem>
        {menu.intoScenarios.map((scenario) => (
          <DropdownMenuItem key={scenario.key} onSelect={() => menu.onMoveInto(scenario.key)}>
            <FilePlus aria-hidden className="size-4" />
            Move into scenario {scenario.number}
          </DropdownMenuItem>
        ))}
        {menu.canMoveOut !== null ? (
          <DropdownMenuItem disabled={!menu.canMoveOut} onSelect={menu.onMoveOut}>
            <FileMinus aria-hidden className="size-4" />
            Move out of the scenario
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={!menu.canRemove} onSelect={menu.onRemove}>
          <Trash2 aria-hidden className="size-4" />
          Remove question
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The sentence a refused save says where the gap is. Live: it goes once the gap is filled. */
function FormProblemLine({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="text-sm font-medium text-destructive motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
    >
      {children}
    </p>
  );
}

/** A visibility's mark, the same one its chip shows on the quiz's page and rows. */
function VisibilityMark({ id, className }: { id: ChannelQuizVisibility; className?: string }) {
  const Mark = VISIBILITY_MARKS[id];
  return <Mark aria-hidden className={cn('size-4 shrink-0 text-muted-foreground', className)} />;
}

/**
 * A scenario's card: its title (optional) and passage, then its questions,
 * then the way to add one more to it. Blue, so a question about a passage
 * never reads as one on its own.
 */
function ScenarioCard({
  number,
  draft,
  problem,
  canMoveUp,
  canMoveDown,
  onMove,
  onChange,
  onRemove,
  onAddQuestion,
  children,
}: {
  number: number;
  draft: ScenarioDraft;
  /** Why a save was refused, when the gap is in this scenario. */
  problem: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  /** The scenario moves with its questions, as one block. */
  onMove: (direction: MoveDirection) => void;
  onChange: (patch: Partial<ScenarioDraft>) => void;
  onRemove: () => void;
  onAddQuestion: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`quiz-scenario-${draft.key}`}
      aria-label={`Scenario ${number}`}
      className={cn(
        'space-y-3 rounded-2xl border-2 border-[oklch(0.62_0.17_255/0.55)] bg-[oklch(0.62_0.17_255/0.07)] p-3',
        problem && 'border-destructive/60',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tracking-[0.12em] text-[oklch(0.7_0.15_255)] uppercase">
          Scenario {number}
        </span>
        <div className="ml-auto flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            disabled={!canMoveUp}
            onClick={() => onMove('up')}
            aria-label={`Move scenario ${number} up`}
          >
            <ArrowUp aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground"
            disabled={!canMoveDown}
            onClick={() => onMove('down')}
            aria-label={`Move scenario ${number} down`}
          >
            <ArrowDown aria-hidden className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onRemove}
          >
            Remove scenario
          </Button>
        </div>
      </div>
      {/* WHAT A SCENARIO IS FOR (Arthur, point 4): a passage several questions
          share, shown above each of them. */}
      <p className="-mt-1 text-xs text-muted-foreground">
        A passage several questions share. The reader sees it above each question in this box.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor={`scenario-title-${draft.key}`}>
          Title <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`scenario-title-${draft.key}`}
          maxLength={QUIZ_SCENARIO_TITLE_MAX}
          placeholder="e.g. The right of way over Plot 14"
          value={draft.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`scenario-passage-${draft.key}`}>Passage</Label>
        <Textarea
          id={`scenario-passage-${draft.key}`}
          rows={5}
          maxLength={QUIZ_SCENARIO_PASSAGE_MAX}
          placeholder="The facts the questions below are about. The reader sees this above each of them."
          value={draft.passage}
          onChange={(event) => onChange({ passage: event.target.value })}
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {draft.passage.length.toLocaleString('en-US')} / {QUIZ_SCENARIO_PASSAGE_MAX.toLocaleString('en-US')}
        </p>
        <QuizSourceLine source={draft.source} />
      </div>
      {problem ? <FormProblemLine>{problem}</FormProblemLine> : null}
      <div className="space-y-3">{children}</div>
      <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onAddQuestion}>
        <Plus aria-hidden className="size-4" />
        Add a question to this scenario
      </Button>
    </section>
  );
}

/**
 * One question (Arthur, 25 October 2026): one compact row for its number,
 * type and timer; the question box as the focus; the answers, where the
 * correct one carries a filled tick and the others their letter; then
 * "Explanation (optional)", quieter than the rest.
 */
function QuestionCard({
  index,
  draft,
  inScenario,
  problem,
  onChange,
  onChangeType,
  menu,
}: {
  index: number;
  draft: QuestionDraft;
  /** Inside a scenario's card: says so beside the number. */
  inScenario: boolean;
  /** Why a save was refused, when the gap is in this question. */
  problem: string | null;
  onChange: (patch: Partial<QuestionDraft>) => void;
  onChangeType: (type: QuizQuestionType) => void;
  /** Its "⋯" menu (Arthur's point 5: reorder, edit, remove). */
  menu: QuestionMenuActions;
}) {
  const isTrueFalse = draft.type === 'true_false';
  const number = index + 1;
  const hintId = `explanation-hint-${draft.key}`;

  return (
    <div
      id={`quiz-question-${draft.key}`}
      className={cn(
        'space-y-3 rounded-xl border border-border/70 bg-card p-3 transition-colors',
        problem && 'border-destructive/60',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="mr-1 text-sm font-semibold text-foreground tabular-nums">Q{number}</span>
        {/* In a scenario's narrower box on a phone the word would push the
            menu off the card, so the mark stands alone there. */}
        {inScenario && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.62_0.17_255/0.14)] px-1.5 py-0.5 text-xs font-medium text-[oklch(0.78_0.1_255)] sm:px-2">
            <FileText aria-hidden className="size-3" />
            <span className="sr-only sm:not-sr-only">Scenario</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Select
            value={draft.type}
            onValueChange={(value) => onChangeType(value as QuizQuestionType)}
          >
            <SelectTrigger size="sm" className="h-8 w-auto gap-1 border-transparent bg-secondary/60 px-2.5 text-xs" aria-label={`Question ${number} type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple_choice">Multiple choice</SelectItem>
              <SelectItem value="true_false">True / false</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={String(draft.seconds)}
            onValueChange={(value) => onChange({ seconds: Number(value) })}
          >
            <SelectTrigger size="sm" className="h-8 w-auto gap-1 border-transparent bg-secondary/60 px-2.5 text-xs tabular-nums" aria-label={`Question ${number} time`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUIZ_SECOND_CHOICES.map((seconds) => (
                <SelectItem key={seconds} value={String(seconds)}>
                  {seconds}s
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <QuestionMenu number={number} menu={menu} />
        </div>
      </div>

      <Textarea
        rows={2}
        maxLength={QUIZ_QUESTION_MAX}
        placeholder="What do you want to ask?"
        value={draft.question}
        onChange={(event) => onChange({ question: event.target.value })}
        aria-label={`Question ${number} text`}
        className="min-h-16 text-base"
      />

      <div className="space-y-1.5">
        <p id={`answers-label-${draft.key}`} className="text-xs text-muted-foreground">
          Answers · tap the circle beside the correct one
        </p>
        {/* `v2-solo`: the quiz's own right-answer green, in both themes (solo-quiz.css). */}
        <div role="radiogroup" aria-labelledby={`answers-label-${draft.key}`} className="v2-solo space-y-1.5">
          {draft.options.map((option, optionIndex) => {
            const letter = optionLetter(optionIndex);
            const correct = draft.correctKey === option.key;
            return (
              <div key={option.key} className="flex items-center gap-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={correct}
                  aria-label={`Answer ${letter} is correct`}
                  onClick={() => onChange({ correctKey: option.key })}
                  className={cn(
                    'v2-interactive flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    correct
                      ? 'border-[var(--solo-right)] bg-[var(--solo-right)] text-[var(--solo-right-ink)]'
                      : 'border-border text-muted-foreground hover:border-foreground/40',
                  )}
                >
                  {correct ? <Check aria-hidden className="size-4" strokeWidth={3} /> : letter}
                </button>
                <Input
                  maxLength={QUIZ_OPTION_MAX}
                  placeholder={`Answer ${letter}`}
                  value={option.content}
                  readOnly={isTrueFalse}
                  className={cn(
                    isTrueFalse && 'text-muted-foreground',
                    correct && 'border-[var(--solo-right)]',
                  )}
                  onChange={(event) =>
                    onChange({
                      options: draft.options.map((entry) =>
                        entry.key === option.key
                          ? { ...entry, content: event.target.value }
                          : entry,
                      ),
                    })
                  }
                  aria-label={`Answer ${letter}`}
                />
                {!isTrueFalse && draft.options.length > QUIZ_MIN_OPTIONS && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-muted-foreground"
                    onClick={() =>
                      onChange({
                        options: draft.options.filter(
                          (entry) => entry.key !== option.key,
                        ),
                        correctKey:
                          draft.correctKey === option.key ? null : draft.correctKey,
                      })
                    }
                    aria-label={`Remove answer ${letter}`}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {!isTrueFalse && draft.options.length < QUIZ_MAX_OPTIONS && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() =>
              onChange({ options: [...draft.options, newOption()] })
            }
          >
            <Plus aria-hidden className="size-4" />
            Add answer
          </Button>
        )}
      </div>

      {problem ? <FormProblemLine>{problem}</FormProblemLine> : null}

      {/* EXPLANATION (Arthur, 22 and 25 October 2026): optional, shown to a
          player only after the quiz, under the right answer; quieter than the
          question and its answers. */}
      <div className="space-y-1">
        <label htmlFor={`explanation-${draft.key}`} className="text-xs font-medium text-muted-foreground">
          Explanation <span className="font-normal text-muted-foreground/70">(optional)</span>
        </label>
        <p id={hintId} className="text-xs text-muted-foreground/80">
          Explain why the correct answer is right. Shown after the quiz.
        </p>
        <Textarea
          id={`explanation-${draft.key}`}
          rows={2}
          maxLength={QUIZ_EXPLANATION_MAX}
          aria-describedby={hintId}
          value={draft.explanation}
          onChange={(event) => onChange({ explanation: event.target.value })}
          className="min-h-14 bg-secondary/30 text-sm"
        />
      </div>
      {/* Where Lawexa took the question from (the quiz builder, 24 October
          2026): shown to the author, as the players see it on the results. */}
      <QuizSourceLine source={draft.source} />
    </div>
  );
}

function QuizFormSkeleton() {
  return (
    <div aria-hidden className="space-y-5">
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-16 w-full rounded-md" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
