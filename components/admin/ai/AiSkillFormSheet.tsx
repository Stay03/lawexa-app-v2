'use client';

import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useCreateAiSkill, useUpdateAiSkill } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import type { AdminAiSkill } from '@/types/admin-ai';
import {
  counterLabel,
  estimateTokens,
  loadModeHint,
  savedAsVersion,
  SKILL_DESCRIPTION_MAX,
  SKILL_INSTRUCTIONS_MAX,
  skillNameProblem,
  suggestSkillName,
  tokensLabel,
} from './skill-model';

interface AiSkillFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skill?: AdminAiSkill | null;
}

const skillFormSchema = z.object({
  name: z.string().superRefine((value, context) => {
    const problem = skillNameProblem(value);
    if (problem) context.addIssue({ code: 'custom', message: problem });
  }),
  display_name: z.string().trim().min(1, 'A display name is required').max(255),
  description: z
    .string()
    .trim()
    .min(1, 'A description is required: it is the one line Lawexa sees')
    .max(SKILL_DESCRIPTION_MAX, `At most ${SKILL_DESCRIPTION_MAX} characters`),
  instructions: z
    .string()
    .trim()
    .min(1, 'The steps are required')
    .max(SKILL_INSTRUCTIONS_MAX, `At most ${SKILL_INSTRUCTIONS_MAX.toLocaleString('en-US')} characters`),
  load_mode: z.enum(['on_demand', 'always_on']),
  is_active: z.boolean(),
  change_note: z.string().max(255).optional(),
});

type SkillFormData = z.infer<typeof skillFormSchema>;

const EMPTY: SkillFormData = {
  name: '',
  display_name: '',
  description: '',
  instructions: '',
  load_mode: 'on_demand',
  is_active: true,
  change_note: '',
};

/**
 * Create or edit a skill (the screen half of a1f45096, 28 October 2026). The
 * `name` is chosen once: Lawexa's `load_skill` calls and the transcripts use
 * it, so it is fixed after create (woz) and shown read-only on edit. Every
 * save is a new version on the server, and the toast says which.
 */
export function AiSkillFormSheet({ open, onOpenChange, skill }: AiSkillFormSheetProps) {
  const isEditMode = !!skill;
  const nameTyped = useRef(false);
  const createMutation = useCreateAiSkill();
  const updateMutation = useUpdateAiSkill();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const form = useForm<SkillFormData>({ resolver: zodResolver(skillFormSchema), defaultValues: EMPTY });
  const description = useWatch({ control: form.control, name: 'description' }) ?? '';
  const instructions = useWatch({ control: form.control, name: 'instructions' }) ?? '';
  const loadMode = useWatch({ control: form.control, name: 'load_mode' }) ?? 'on_demand';
  const tokens = estimateTokens(instructions);

  useEffect(() => {
    if (!open) return;
    nameTyped.current = false;
    form.reset(
      skill
        ? {
            name: skill.name,
            display_name: skill.display_name,
            description: skill.description,
            instructions: skill.instructions,
            load_mode: skill.load_mode,
            is_active: skill.is_active,
            change_note: '',
          }
        : EMPTY,
    );
  }, [open, skill, form]);

  const onSubmit = (data: SkillFormData) => {
    const onSuccess = (response: { message: string; data: AdminAiSkill | null }) => {
      toast.success(response.data ? savedAsVersion(response.data.version) : response.message);
      onOpenChange(false);
    };
    const onError = (error: unknown) => {
      const apiError = extractApiError(error);
      if (apiError.errors) {
        Object.entries(apiError.errors).forEach(([field, messages]) => {
          if (field in EMPTY) form.setError(field as keyof SkillFormData, { message: messages[0] });
          else toast.error(messages[0]);
        });
      } else {
        toast.error(apiError.message);
      }
    };

    if (isEditMode && skill) {
      updateMutation.mutate(
        {
          id: skill.id,
          data: {
            display_name: data.display_name,
            description: data.description,
            instructions: data.instructions,
            load_mode: data.load_mode,
            is_active: data.is_active,
            change_note: data.change_note?.trim() || undefined,
          },
        },
        { onSuccess, onError },
      );
    } else {
      createMutation.mutate(
        {
          name: data.name,
          display_name: data.display_name,
          description: data.description,
          instructions: data.instructions,
          load_mode: data.load_mode,
          is_active: data.is_active,
        },
        { onSuccess, onError },
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit Skill' : 'New Skill'}</SheetTitle>
          <SheetDescription>
            {isEditMode
              ? `Saving makes version ${(skill?.version ?? 0) + 1}. Earlier versions stay in the history.`
              : 'A named set of steps for one kind of task. Nothing reaches Lawexa until it is on an agent.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1">
            <div className="space-y-4 px-6 py-4 flex-1">
              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Research a legal question"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          if (!isEditMode && !nameTyped.current) {
                            form.setValue('name', suggestSkillName(event.target.value), { shouldValidate: true });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. research_legal_question"
                        className="font-mono text-sm"
                        readOnly={isEditMode}
                        aria-readonly={isEditMode}
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          nameTyped.current = true;
                          form.trigger('name');
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {isEditMode
                        ? 'Fixed after create: Lawexa loads the skill by this name.'
                        : 'Lowercase letters, digits and underscores. It cannot change later.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="The one line Lawexa sees, e.g. Use when the user asks a legal question that needs cases and statutes."
                        className="min-h-[64px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="flex justify-between gap-3">
                      <span>Lawexa sees this line on every turn and decides from it.</span>
                      <span className="tabular-nums shrink-0">{counterLabel(description.length, SKILL_DESCRIPTION_MAX)}</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
                <FormField
                  control={form.control}
                  name="load_mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Load mode</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full sm:w-[220px]">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="on_demand">On demand</SelectItem>
                          <SelectItem value="always_on">Always on</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>{loadModeHint(loadMode, tokens)}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 space-y-0 sm:pt-8">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="font-normal">Active</FormLabel>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Steps</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={'1. …\n2. …'}
                        className="min-h-[320px] font-mono text-xs leading-relaxed"
                        spellCheck={false}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="flex justify-between gap-3">
                      <span>{tokensLabel(tokens)}</span>
                      <span className="tabular-nums">{counterLabel(instructions.length, SKILL_INSTRUCTIONS_MAX)}</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditMode ? (
                <FormField
                  control={form.control}
                  name="change_note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Change note (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Ask for the court before searching" {...field} />
                      </FormControl>
                      <FormDescription>Shown beside this version in the history.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            <SheetFooter className="px-6 pb-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditMode ? 'Save version' : 'Create Skill'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
