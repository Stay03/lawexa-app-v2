'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  ChannelQuizSettings,
  QuizQuestionInput,
  QuizQuestionType,
} from '@/types/channel-quiz';
import { useCreateLibraryQuiz, useCreateQuiz, useUpdateQuiz } from './mutations';
import { channelQuizQueries } from './queries';
import {
  optionLetter,
  QUIZ_DEFAULT_SECONDS,
  QUIZ_DEFAULT_SETTINGS,
  QUIZ_DESCRIPTION_MAX,
  QUIZ_MAX_OPTIONS,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MIN_OPTIONS,
  QUIZ_OPTION_MAX,
  QUIZ_QUESTION_MAX,
  QUIZ_SECOND_CHOICES,
  QUIZ_TITLE_MAX,
} from './model';

/**
 * QuizFormDialog — write a quiz, or edit one that hasn't been played.
 *
 * Phase-5 W6; rules from `docs/api/channel-quiz.md` (backend repo): 1–20
 * questions · 2–4 options with exactly one correct · `true_false` is exactly
 * two · 5–60 second timers. Every one of them is checked here as well as
 * server-side, because a validation error that costs a round trip on question
 * seventeen is a bad way to learn about question three.
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
 */

interface OptionDraft {
  key: string;
  content: string;
}

interface QuestionDraft {
  key: string;
  type: QuizQuestionType;
  question: string;
  seconds: number;
  options: OptionDraft[];
  /** The `key` of the option marked correct — exactly one, or none yet. */
  correctKey: string | null;
}

let draftCounter = 0;
function nextKey(prefix: string): string {
  draftCounter += 1;
  return `${prefix}-${draftCounter}`;
}

function newOption(content = ''): OptionDraft {
  return { key: nextKey('opt'), content };
}

function newQuestion(): QuestionDraft {
  return {
    key: nextKey('q'),
    type: 'multiple_choice',
    question: '',
    seconds: QUIZ_DEFAULT_SECONDS,
    options: [newOption(), newOption()],
    correctKey: null,
  };
}

/** True/false questions are exactly two fixed options — the server validates
 *  the count, and offering free text for them would only invite a 422. */
function trueFalseOptions(): OptionDraft[] {
  return [newOption('True'), newOption('False')];
}

function draftsFromQuiz(quiz: ChannelQuiz): QuestionDraft[] {
  return (quiz.questions ?? []).map((question) => {
    const options = question.options.map((option) => ({
      key: nextKey('opt'),
      content: option.content,
    }));
    const correctIndex = question.options.findIndex((option) => option.is_correct);
    return {
      key: nextKey('q'),
      type: question.type,
      question: question.question,
      seconds: question.time_limit_seconds,
      options,
      correctKey: correctIndex >= 0 ? options[correctIndex].key : null,
    };
  });
}

/** The first thing wrong with the draft, phrased for the author — or `null`. */
function validate(title: string, questions: QuestionDraft[]): string | null {
  if (!title.trim()) return 'Give the quiz a title.';
  if (questions.length === 0) return 'Add at least one question.';
  for (let i = 0; i < questions.length; i += 1) {
    const question = questions[i];
    const label = `Question ${i + 1}`;
    if (!question.question.trim()) return `${label} needs its question text.`;
    const filled = question.options.filter((option) => option.content.trim());
    if (filled.length < QUIZ_MIN_OPTIONS) {
      return `${label} needs at least ${QUIZ_MIN_OPTIONS} answers.`;
    }
    if (question.correctKey === null) {
      return `${label} needs one answer marked correct.`;
    }
    if (!filled.some((option) => option.key === question.correctKey)) {
      return `${label}'s correct answer is empty.`;
    }
  }
  return null;
}

function toPayload(questions: QuestionDraft[]): QuizQuestionInput[] {
  return questions.map((question) => ({
    type: question.type,
    question: question.question.trim(),
    time_limit_seconds: question.seconds,
    options: question.options
      .filter((option) => option.content.trim())
      .map((option) => ({
        content: option.content.trim(),
        is_correct: option.key === question.correctKey,
      })),
  }));
}

/** Where a NEW quiz is filed. Ignored when editing — a quiz's home is fixed. */
export type QuizDestination = 'channel' | 'library';

export function QuizFormDialog({
  open,
  onOpenChange,
  channelUuid,
  channelName,
  destination,
  viewerId,
  quizUuid,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelUuid: string;
  /** Named in the destination line, so "this channel" is never abstract. */
  channelName: string;
  destination: QuizDestination;
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

  const createQuiz = useCreateQuiz(channelUuid);
  const createLibraryQuiz = useCreateLibraryQuiz();
  const updateQuiz = useUpdateQuiz(quizUuid ?? '');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [settings, setSettings] = useState<ChannelQuizSettings>(
    QUIZ_DEFAULT_SETTINGS,
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(() => [
    newQuestion(),
  ]);
  const [error, setError] = useState<string | null>(null);
  /** Set when the server refuses a question change on a played quiz. */
  const [frozen, setFrozen] = useState(false);

  // Adopt the loaded quiz ONCE, in render (the sanctioned adjust-on-prop-change
  // pattern) — an effect would paint one frame of an empty form over a quiz the
  // author asked to edit.
  const [adopted, setAdopted] = useState<string | null>(null);
  if (loaded && adopted !== loaded.uuid) {
    setAdopted(loaded.uuid);
    setTitle(loaded.title);
    setDescription(loaded.description ?? '');
    setSettings({ ...QUIZ_DEFAULT_SETTINGS, ...loaded.settings });
    setQuestions(draftsFromQuiz(loaded));
    setFrozen(false);
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

  const handleSubmit = (metadataOnly = false) => {
    setError(null);
    // A metadata-only save (the played-quiz path) still needs a title — the
    // questions it cannot touch are not its business.
    const problem = metadataOnly
      ? title.trim()
        ? null
        : 'Give the quiz a title.'
      : validate(title, questions);
    if (problem) {
      setError(problem);
      return;
    }

    const onError = (mutationError: Error) => {
      const { status, message } = extractApiError(mutationError);
      if (status === 409 && !metadataOnly) {
        // The documented freeze — not a failure, a rule.
        setFrozen(true);
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
          settings,
          questions:
            metadataOnly || !mayEditQuestions ? undefined : toPayload(questions),
        },
        {
          onSuccess: (response) => {
            onOpenChange(false);
            onSaved?.(response.data);
          },
          onError,
        },
      );
      return;
    }

    const create = destination === 'library' ? createLibraryQuiz : createQuiz;
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        settings,
        questions: toPayload(questions),
      },
      {
        onSuccess: (response) => {
          onOpenChange(false);
          onSaved?.(response.data);
        },
        onError,
      },
    );
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      className="md:max-w-2xl"
      title={
        isEdit
          ? 'Edit quiz'
          : destination === 'library'
            ? 'New quiz in your library'
            : `New quiz in ${channelName}`
      }
      description={
        <>
          Up to {QUIZ_MAX_QUESTIONS} questions. Everyone answers on their own
          device, and faster right answers score more.
          {/* THE CONSEQUENCE, STATED — one line, only while it is still a
              choice. An edit cannot move a quiz, so it says nothing. It is a
              `span` and not a `p` because `DialogDescription` IS a paragraph,
              and a paragraph inside a paragraph is markup the browser silently
              rewrites — closing the outer one early and leaving the sentence
              orphaned outside the element the dialog is described by. */}
          {!isEdit && (
            <span className="mt-1 block text-xs">
              {destination === 'library'
                ? 'It stays yours and appears in no channel until you run it in one — then that channel can see it too.'
                : `It belongs to ${channelName} and to you, and it is in your library either way.`}
            </span>
          )}
        </>
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          {/* A quiz whose questions are frozen (played) or not this viewer's to
              rewrite saves its METADATA — and validating questions it cannot
              touch would lock the reader out of the save that does work. */}
          <Button
            onClick={() => handleSubmit(frozen || !mayEditQuestions)}
            disabled={submitting}
          >
            {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {frozen || !mayEditQuestions
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
                placeholder="e.g. Land law — week 4"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quiz-description">Description</Label>
              <Textarea
                id="quiz-description"
                maxLength={QUIZ_DESCRIPTION_MAX}
                rows={2}
                placeholder="Optional — what is this quiz for?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="space-y-3 rounded-lg border p-3">
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
            </div>

            {!mayEditQuestions && (
              <p className="rounded-lg border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
                You can change this quiz&rsquo;s title, description and
                settings. Its questions belong to its author.
              </p>
            )}

            {frozen && (
              <p className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
                This quiz has already been played, so its questions are locked
                — scores would stop meaning anything if they could change
                underneath. The title, description and settings can still be
                saved. To change the questions, write a new quiz.
              </p>
            )}

            {mayEditQuestions && !frozen && (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <QuestionCard
                    key={question.key}
                    index={index}
                    draft={question}
                    canRemove={questions.length > 1}
                    onChange={(patch) => updateQuestion(question.key, patch)}
                    onChangeType={(type) => setType(question.key, type)}
                    onRemove={() =>
                      setQuestions((prev) =>
                        prev.filter((entry) => entry.key !== question.key),
                      )
                    }
                  />
                ))}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={questions.length >= QUIZ_MAX_QUESTIONS}
                  onClick={() =>
                    setQuestions((prev) => [...prev, newQuestion()])
                  }
                >
                  <Plus aria-hidden className="size-4" />
                  Add question ({questions.length}/{QUIZ_MAX_QUESTIONS})
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </div>
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

function QuestionCard({
  index,
  draft,
  canRemove,
  onChange,
  onChangeType,
  onRemove,
}: {
  index: number;
  draft: QuestionDraft;
  canRemove: boolean;
  onChange: (patch: Partial<QuestionDraft>) => void;
  onChangeType: (type: QuizQuestionType) => void;
  onRemove: () => void;
}) {
  const isTrueFalse = draft.type === 'true_false';

  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Question {index + 1}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={draft.type}
            onValueChange={(value) => onChangeType(value as QuizQuestionType)}
          >
            <SelectTrigger size="sm" className="w-36">
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
            <SelectTrigger size="sm" className="w-24">
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
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label={`Remove question ${index + 1}`}
            >
              <Trash2 aria-hidden className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <Textarea
        rows={2}
        maxLength={QUIZ_QUESTION_MAX}
        placeholder="What do you want to ask?"
        value={draft.question}
        onChange={(event) => onChange({ question: event.target.value })}
        aria-label={`Question ${index + 1} text`}
      />

      <fieldset className="space-y-2">
        <legend className="text-xs text-muted-foreground">
          Answers — mark the correct one
        </legend>
        {draft.options.map((option, optionIndex) => (
          <div key={option.key} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${draft.key}`}
              checked={draft.correctKey === option.key}
              onChange={() => onChange({ correctKey: option.key })}
              className="size-4 shrink-0 accent-primary"
              aria-label={`Mark answer ${optionLetter(optionIndex)} correct`}
            />
            <Input
              maxLength={QUIZ_OPTION_MAX}
              placeholder={`Answer ${optionLetter(optionIndex)}`}
              value={option.content}
              readOnly={isTrueFalse}
              className={cn(isTrueFalse && 'text-muted-foreground')}
              onChange={(event) =>
                onChange({
                  options: draft.options.map((entry) =>
                    entry.key === option.key
                      ? { ...entry, content: event.target.value }
                      : entry,
                  ),
                })
              }
              aria-label={`Answer ${optionLetter(optionIndex)}`}
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
                aria-label={`Remove answer ${optionLetter(optionIndex)}`}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            )}
          </div>
        ))}
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
      </fieldset>
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
