'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { extractApiError } from '@/lib/utils/api-error';
import type { MySkill, MySkillInput } from '@/types/private-items';
import { MarkdownText } from '@/v2/features/conversations/conversation/markdown/MarkdownText';
import { ResponsiveOverlay } from '@/v2/shell/overlay/ResponsiveOverlay';
import { SKILL_LIMITS, skillProblems } from './model';
import { privateItemsQueries, useSkillMutations } from './queries';

type Field = 'display_name' | 'description' | 'instructions' | 'example_output';

/**
 * "Write it myself" and Edit (Arthur's pages, 19 November 2026): a name, the
 * "When Lawexa uses it" line (Lawexa picks skills from this line, so it
 * matters), the steps, and an example of a good answer. Beside them, Test runs
 * a sample request with what is on the screen, saved or not, and shows the
 * answer; it costs one message, charged only when an answer comes back.
 *
 * It works at once in the person's own chats, with no admin review. Mounted
 * per open (the host keys it). The server's sentences show under their field.
 */
export function SkillDialog({
  skill,
  onSave,
  onClose,
}: {
  /** Null to write a new one. */
  skill: MySkill | null;
  onSave: (input: MySkillInput) => Promise<unknown>;
  onClose: () => void;
}) {
  const [input, setInput] = useState<MySkillInput>({
    display_name: skill?.display_name ?? '',
    description: skill?.description ?? '',
    instructions: skill?.instructions ?? '',
    example_output: skill?.example_output ?? '',
  });
  const [tried, setTried] = useState(false);
  const [serverProblems, setServerProblems] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const local = skillProblems(input);
  const problemOf = (field: Field) => serverProblems[field] ?? (tried ? local[field as keyof typeof local] : undefined);
  const changed =
    input.display_name !== (skill?.display_name ?? '') ||
    input.description !== (skill?.description ?? '') ||
    input.instructions !== (skill?.instructions ?? '') ||
    (input.example_output ?? '') !== (skill?.example_output ?? '');

  const set = (field: Field, value: string) => {
    setInput((current) => ({ ...current, [field]: value }));
    setServerProblems((current) => ({ ...current, [field]: undefined }));
  };

  const trimmed = (): MySkillInput => ({
    display_name: input.display_name.trim(),
    description: input.description.trim(),
    instructions: input.instructions.trim(),
    example_output: input.example_output?.trim() || null,
  });

  const save = async () => {
    setTried(true);
    if (Object.keys(local).length > 0) return;
    setSaving(true);
    try {
      await onSave(trimmed());
    } catch (error) {
      const apiError = extractApiError(error);
      const fields = apiError.errors ?? {};
      const found = {
        display_name: fields.name?.[0] ?? fields.display_name?.[0],
        description: fields.description?.[0],
        instructions: fields.instructions?.[0],
        example_output: fields.example_output?.[0],
      };
      setServerProblems(Object.values(found).some(Boolean) ? found : { display_name: apiError.message });
    } finally {
      setSaving(false);
    }
  };

  const field = (id: Field, label: string, control: React.ReactNode, hint?: string) => {
    const problem = problemOf(id);
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={`skill-${id}`}>{label}</Label>
        {control}
        {problem ? (
          <p id={`skill-${id}-error`} role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : hint ? (
          <p className="text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    );
  };

  return (
    <ResponsiveOverlay
      open
      onOpenChange={(next) => (next ? undefined : onClose())}
      guardUnsaved={changed}
      className="md:max-w-5xl"
      title={skill ? 'Edit skill' : 'New skill'}
      description="It works at once, in your own chats only."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            {skill ? 'Save changes' : 'Save skill'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_22rem] md:items-start">
        <div className="flex flex-col gap-4">
          {field(
            'display_name',
            'Name',
            <Input
              id="skill-display_name"
              value={input.display_name}
              maxLength={SKILL_LIMITS.display_name}
              autoFocus={!skill}
              placeholder="Tenancy notice review"
              onChange={(event) => set('display_name', event.target.value)}
              aria-invalid={problemOf('display_name') !== undefined}
            />,
          )}
          {field(
            'description',
            'When Lawexa uses it',
            <Input
              id="skill-description"
              value={input.description}
              maxLength={SKILL_LIMITS.description}
              placeholder="When I ask it to check a quit notice served on a tenant in Lagos"
              onChange={(event) => set('description', event.target.value)}
              aria-invalid={problemOf('description') !== undefined}
            />,
            'Lawexa picks a skill from this line alone, so say what kind of request it is for.',
          )}
          {field(
            'instructions',
            'Steps',
            <Textarea
              id="skill-instructions"
              value={input.instructions}
              maxLength={SKILL_LIMITS.instructions}
              rows={10}
              placeholder={'1. Ask for the notice and the tenancy agreement.\n2. Check how the notice was served.\n3. …'}
              onChange={(event) => set('instructions', event.target.value)}
              className="min-h-48 text-[14px] leading-relaxed"
              aria-invalid={problemOf('instructions') !== undefined}
            />,
            'What Lawexa does, step by step, when the skill fits.',
          )}
          {field(
            'example_output',
            'Example of a good answer (optional)',
            <Textarea
              id="skill-example_output"
              value={input.example_output ?? ''}
              rows={5}
              placeholder="Paste an answer you were happy with. Lawexa matches its shape and tone."
              onChange={(event) => set('example_output', event.target.value)}
              className="min-h-28 text-[14px] leading-relaxed"
            />,
          )}
        </div>
        <SkillTest uuid={skill?.uuid ?? null} input={trimmed()} ready={Object.keys(local).length === 0} />
      </div>
    </ResponsiveOverlay>
  );
}

/**
 * Test: a sample request, run with what is on the screen, and the answer. The
 * run is a job (Backend, 19 November 2026): Run test starts it, and its answer
 * is read every few seconds until it is done or failed.
 */
function SkillTest({ uuid, input, ready }: { uuid: string | null; input: MySkillInput; ready: boolean }) {
  const { test } = useSkillMutations();
  const [request, setRequest] = useState('');
  const [runUuid, setRunUuid] = useState<string | null>(null);
  const run = useQuery(privateItemsQueries.skillTestRun(runUuid)).data ?? null;
  const running = test.isPending || (runUuid !== null && (run === null || run.status === 'running'));
  const failure = test.error
    ? extractApiError(test.error).message || 'The test did not start.'
    : run?.status === 'failed'
      ? run.error?.message || 'The test did not finish. Nothing was charged.'
      : null;
  const answer = run?.status === 'done' ? run.answer : null;
  const start = () =>
    test.mutate({ uuid, request: request.trim(), input }, { onSuccess: (started) => setRunUuid(started.uuid) });
  return (
    <section aria-labelledby="skill-test" className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/40 p-4 md:sticky md:top-0">
      <h3 id="skill-test" className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <FlaskConical aria-hidden className="size-4 text-muted-foreground" />
        Test it
      </h3>
      <Textarea
        value={request}
        onChange={(event) => setRequest(event.target.value)}
        rows={3}
        aria-label="A sample request"
        placeholder="A request it should handle, e.g. My client got a 7-day quit notice for a yearly tenancy in Ikeja. Is it valid?"
        className="bg-background text-[14px]"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={!ready || !request.trim() || running} onClick={start}>
          {running ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          {running ? 'Running…' : 'Run test'}
        </Button>
        <span className="text-xs text-muted-foreground">Uses one message</span>
      </div>
      {running ? (
        <p role="status" className="text-xs text-muted-foreground">
          Lawexa is following your steps. This usually takes 10 to 30 seconds.
        </p>
      ) : failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      ) : answer ? (
        <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-background p-3 text-[14px]">
          <MarkdownText content={answer} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">The answer shows here. Nothing is saved, and no chat is made.</p>
      )}
    </section>
  );
}
