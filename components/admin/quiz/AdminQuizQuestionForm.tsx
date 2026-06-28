'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  adminQuizQuestionSchema,
  type AdminQuizQuestionFormData,
} from '@/lib/validations/admin-quiz';
import {
  useAdminQuizQuestion,
  useUpdateAdminQuizQuestion,
} from '@/lib/hooks/useAdminQuiz';
import { extractApiError } from '@/lib/utils/api-error';
import { cn } from '@/lib/utils';
import type { AdminQuizQuestionDetail } from '@/types/admin-quiz';
import type { QuizDifficulty } from '@/types/quiz';

interface AdminQuizQuestionFormProps {
  uuid: string;
}

/** Loads the question, then renders the prefilled edit form. */
export function AdminQuizQuestionForm({ uuid }: AdminQuizQuestionFormProps) {
  const query = useAdminQuizQuestion(uuid);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        {query.error ? extractApiError(query.error).message : 'Question not found.'}
      </div>
    );
  }

  return <QuestionFormFields question={query.data.data} />;
}

function QuestionFormFields({ question }: { question: AdminQuizQuestionDetail }) {
  const router = useRouter();
  const update = useUpdateAdminQuizQuestion();
  const sortedOptions = [...question.options].sort((a, b) => a.position - b.position);
  const correctFromData = sortedOptions.findIndex((o) => o.is_correct);

  const form = useForm<AdminQuizQuestionFormData>({
    resolver: zodResolver(adminQuizQuestionSchema),
    defaultValues: {
      question_text: question.question_text,
      explanation: question.explanation ?? '',
      difficulty: question.difficulty,
      topic: question.topic,
      options: sortedOptions.map((o) => o.option_text),
      correct_index: correctFromData >= 0 ? correctFromData : 0,
      moderation_notes: '',
    },
  });

  const correctIndex = useWatch({ control: form.control, name: 'correct_index' });
  const hasOptionError = !!form.formState.errors.options;

  const onSubmit = (data: AdminQuizQuestionFormData) => {
    update.mutate(
      {
        uuid: question.uuid,
        data: {
          question_text: data.question_text,
          explanation: data.explanation?.trim() ? data.explanation : null,
          difficulty: data.difficulty as QuizDifficulty,
          topic: data.topic,
          options: data.options,
          correct_index: data.correct_index,
          moderation_notes: data.moderation_notes?.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Question updated.');
          router.push(`/admin/quiz/questions/${question.uuid}`);
        },
        onError: (error) =>
          toast.error('Update failed', {
            description: extractApiError(error).message,
          }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/admin/quiz/questions/${question.uuid}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to question
        </Link>
      </Button>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
          <FormField
            control={form.control}
            name="question_text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Question</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label>
              Options{' '}
              <span className="font-normal text-muted-foreground">
                (select the correct answer)
              </span>
            </Label>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    form.setValue('correct_index', i, { shouldValidate: true })
                  }
                  aria-label={`Mark option ${i + 1} correct`}
                  aria-pressed={correctIndex === i}
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    correctIndex === i
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/30 hover:border-primary/50'
                  )}
                >
                  {correctIndex === i && <Check className="h-3.5 w-3.5" />}
                </button>
                <Input
                  placeholder={`Option ${i + 1}`}
                  {...form.register(`options.${i}` as const)}
                />
              </div>
            ))}
            {hasOptionError && (
              <p className="text-sm text-destructive">
                All four options must be filled in.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-6">
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Difficulty</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          Level {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Topic</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="explanation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Explanation{' '}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="moderation_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Moderation note{' '}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Textarea rows={2} placeholder="Why are you editing this?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
            <Button asChild type="button" variant="ghost">
              <Link href={`/admin/quiz/questions/${question.uuid}`}>Cancel</Link>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
