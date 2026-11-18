'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useAdminAiAgents, useCreateAiSkill, useSkillDefaultAgents, useUpdateAiSkill } from '@/lib/hooks/useAdminAi';
import { extractApiError } from '@/lib/utils/api-error';
import { agentIdsPayload, agentRows, chosenAgentIds, createdOnAgents, toggleAgentId } from '@/lib/utils/skill-agents';
import type { AdminAiCreatedSkill, AdminAiSkill } from '@/types/admin-ai';
import {
  changesVersion,
  counterLabel,
  estimateTokens,
  loadModeHint,
  savedAsVersion,
  savedEditMessage,
  SKILL_CHANGE_NOTE_MAX,
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

/**
 * The form's rules. The name rule is for a new name only: on edit the name is
 * fixed and may be one the server allows but the form's stricter rule does
 * not (a seeded `foo_`), which must not stop a save.
 */
const skillFormSchema = (isEditMode: boolean) =>
  z.object({
    name: isEditMode
      ? z.string()
      : z.string().superRefine((value, context) => {
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
    change_note: z.string().max(SKILL_CHANGE_NOTE_MAX, `At most ${SKILL_CHANGE_NOTE_MAX} characters`).optional(),
    // A new skill's agents once the admin touches a box; null keeps the server's defaults.
    agent_ids: z.array(z.number()).nullable(),
  });

type SkillFormData = z.infer<ReturnType<typeof skillFormSchema>>;

const EMPTY: SkillFormData = {
  name: '',
  display_name: '',
  description: '',
  instructions: '',
  load_mode: 'on_demand',
  is_active: true,
  change_note: '',
  agent_ids: null,
};

/**
 * Create or edit a skill (the screen half of a1f45096, 28 October 2026). The
 * `name` is chosen once: Lawexa's `load_skill` calls and the transcripts use
 * it, so it is fixed after create (woz) and shown read-only on edit. Every
 * save is a new version on the server, and the toast says which.
 *
 * A NEW skill picks its agents here (Arthur, 18 November 2026; server
 * d8fda929): the default agents start ticked, any box can be unticked, and
 * the ticks go with the create as `agent_ids`. Until the defaults answer, or
 * if they fail, nothing is sent and the server uses its defaults. Editing a
 * skill's agents stays on the skill's page (AiSkillAgentManager).
 */
export function AiSkillFormSheet({ open, onOpenChange, skill }: AiSkillFormSheetProps) {
  const isEditMode = !!skill;
  const nameTyped = useRef(false);
  const createMutation = useCreateAiSkill();
  const updateMutation = useUpdateAiSkill();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const resolver = useMemo(() => zodResolver(skillFormSchema(isEditMode)), [isEditMode]);
  const form = useForm<SkillFormData>({ resolver, defaultValues: EMPTY });
  const displayName = useWatch({ control: form.control, name: 'display_name' }) ?? '';
  const description = useWatch({ control: form.control, name: 'description' }) ?? '';
  const instructions = useWatch({ control: form.control, name: 'instructions' }) ?? '';
  const loadMode = useWatch({ control: form.control, name: 'load_mode' }) ?? 'on_demand';
  const pickedAgents = useWatch({ control: form.control, name: 'agent_ids' }) ?? null;
  const choosingAgents = open && !isEditMode;
  const defaultAgents = useSkillDefaultAgents(choosingAgents);
  const activeAgents = useAdminAiAgents({ per_page: 100, active_only: true }, { enabled: choosingAgents });
  const defaultList = defaultAgents.data?.data.agents ?? null;
  const rows = defaultList ? agentRows(activeAgents.data?.data ?? [], defaultList) : [];
  const rowOrder = rows.map((agent) => agent.id);
  const chosenAgents = chosenAgentIds(pickedAgents, defaultList ? defaultList.map((agent) => agent.id) : null);
  const tokens = estimateTokens(instructions);
  const makesVersion =
    !skill ||
    changesVersion(skill, { display_name: displayName, description, instructions, load_mode: loadMode });

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
            agent_ids: null,
          }
        : EMPTY,
    );
  }, [open, skill, form]);

  const onSubmit = (data: SkillFormData) => {
    const onSuccess = (response: { message: string; data: AdminAiSkill | null }) => {
      if (!response.data) toast.success(response.message);
      else if (skill) toast.success(savedEditMessage(skill.version, response.data.version, !!data.change_note?.trim()));
      else toast.success(savedAsVersion(response.data.version));
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
            change_note: makesVersion ? data.change_note?.trim() || undefined : undefined,
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
          ...agentIdsPayload(chosenAgents),
        },
        {
          onSuccess: (response: { message: string; data: AdminAiCreatedSkill | null }) => {
            toast.success(response.data ? createdOnAgents(response.data.version, response.data.agents) : response.message);
            onOpenChange(false);
          },
          onError,
        },
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Edit Skill' : 'New Skill'}</SheetTitle>
          <SheetDescription>
            {skill
              ? makesVersion
                ? `Saving makes version ${skill.version + 1}. Earlier versions stay in the history.`
                : `A change to the display name, description, steps or load mode makes version ${skill.version + 1}; Active alone keeps version ${skill.version}.`
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
                        <Input
                          placeholder="e.g. Ask for the court before searching"
                          {...field}
                          disabled={!makesVersion}
                        />
                      </FormControl>
                      <FormDescription>
                        {makesVersion
                          ? 'Shown beside this version in the history.'
                          : 'Goes with a new version: change the steps or another versioned field first.'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <fieldset className="space-y-2" aria-describedby="skill-agents-hint">
                  <legend className="text-sm font-medium leading-none">Agents</legend>
                  {defaultAgents.isPending ? (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                      Loading the default agents…
                    </p>
                  ) : defaultAgents.isError || chosenAgents === null ? (
                    <p className="text-sm text-muted-foreground">
                      The default agents could not load. The skill still goes on them when you create it.
                    </p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {rows.map((agent) => {
                        const id = `skill-agent-${agent.id}`;
                        return (
                          <li key={agent.id} className="flex items-center gap-2.5">
                            <Checkbox
                              id={id}
                              checked={chosenAgents.includes(agent.id)}
                              disabled={isPending}
                              onCheckedChange={() =>
                                form.setValue('agent_ids', toggleAgentId(chosenAgents, agent.id, rowOrder), {
                                  shouldDirty: true,
                                })
                              }
                            />
                            <label htmlFor={id} className="text-sm leading-none">
                              {agent.name}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p id="skill-agents-hint" className="text-sm text-muted-foreground">
                    {chosenAgents !== null && chosenAgents.length === 0
                      ? 'On no agent, Lawexa never uses it. You can add agents later on the skill’s page.'
                      : 'Lawexa uses the skill only on the agents ticked. The default agents start ticked.'}
                  </p>
                </fieldset>
              )}
            </div>

            <SheetFooter className="px-6 pb-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!isEditMode ? 'Create Skill' : makesVersion ? 'Save version' : 'Save'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
