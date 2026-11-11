'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  bracketProblem,
  DEFAULT_CERTIFICATE_BODY,
  DEFAULT_CERTIFICATE_COLORS,
  DEFAULT_CERTIFICATE_TITLE,
  templateFormProblems,
  unknownFillIns,
  type TemplateFormValues,
} from '@/lib/certificates/model';
import { useDeleteCertificateTemplate, useSaveCertificateTemplate } from '@/lib/hooks/useAdminCertificates';
import { extractApiError } from '@/lib/utils/api-error';
import { CERTIFICATE_FILL_INS, type CertificateColors, type CertificateTemplate } from '@/types/certificates';
import { TemplateLogos } from './TemplateLogos';
import { TemplatePreview } from './TemplatePreview';
import { TemplateSignatories } from './TemplateSignatories';

const COLOR_FIELDS: Array<{ key: keyof CertificateColors; label: string }> = [
  { key: 'primary', label: 'Main colour' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Paper' },
];

function initialValues(template: CertificateTemplate | null): TemplateFormValues {
  return template
    ? { name: template.name, title: template.title, body: template.body, colors: { ...template.colors } }
    : {
        name: '',
        title: DEFAULT_CERTIFICATE_TITLE,
        body: DEFAULT_CERTIFICATE_BODY,
        colors: { ...DEFAULT_CERTIFICATE_COLORS },
      };
}

/**
 * One certificate design: the wording with its fill-ins, the colours, the
 * logos and the signatories, beside a live preview of the real PDF. A new
 * design is saved as a draft first, because logos, signatures and the preview
 * all belong to a saved design.
 */
export function CertificateTemplateEditor({ template }: { template: CertificateTemplate | null }) {
  const router = useRouter();
  const save = useSaveCertificateTemplate();
  const remove = useDeleteCertificateTemplate();
  const [values, setValues] = useState<TemplateFormValues>(() => initialValues(template));
  const [showProblems, setShowProblems] = useState(false);
  const [serverProblem, setServerProblem] = useState<string | null>(null);

  const problems = useMemo(() => templateFormProblems(values), [values]);
  const strayFillIns = useMemo(() => unknownFillIns(values.body), [values.body]);
  const brackets = useMemo(() => bracketProblem(values.body), [values.body]);
  const visible = showProblems ? problems : {};
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues(template));
  const partsVersion = useMemo(
    () => JSON.stringify([template?.logos, template?.signatories, template?.updated_at]),
    [template],
  );

  const set = <K extends keyof TemplateFormValues>(key: K, value: TemplateFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const setColor = (key: keyof CertificateColors, value: string) =>
    setValues((current) => ({ ...current, colors: { ...current.colors, [key]: value } }));

  const submit = () => {
    setShowProblems(true);
    setServerProblem(null);
    if (Object.keys(problems).length > 0) return;
    save.mutate(
      {
        uuid: template?.uuid ?? null,
        payload: {
          name: values.name.trim(),
          title: values.title.trim(),
          body: values.body,
          colors: values.colors,
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(template ? 'Design saved' : 'Design created. Add logos and signatories next.');
          if (!template) router.replace(`/admin/certificates/templates/${saved.uuid}`);
        },
        onError: (cause) => setServerProblem(extractApiError(cause).message),
      },
    );
  };

  const destroy = () => {
    if (!template) return;
    remove.mutate(template.uuid, {
      onSuccess: () => {
        toast.success('Design deleted');
        router.replace('/admin/certificates/templates');
      },
      onError: (cause) => setServerProblem(extractApiError(cause).message),
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-8">
        <section className="space-y-4" aria-label="Wording and colours">
          <Field id="template-name" label="Design name" hint="For admins only. Never printed." error={visible.name}>
            <Input id="template-name" value={values.name} onChange={(event) => set('name', event.target.value)} />
          </Field>

          <Field id="template-title" label="Title" error={visible.title}>
            <Input id="template-title" value={values.title} onChange={(event) => set('title', event.target.value)} />
          </Field>

          <Field
            id="template-body"
            label="Wording"
            hint={`Printed under the name. Fill-ins: ${CERTIFICATE_FILL_INS.map((fill) => `{${fill}}`).join(' ')}. Text in [square brackets] is left out when a fill-in inside it is empty.`}
            error={visible.body}
          >
            <Textarea
              id="template-body"
              rows={5}
              value={values.body}
              onChange={(event) => set('body', event.target.value)}
            />
          </Field>
          {strayFillIns.length > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {strayFillIns.join(', ')} {strayFillIns.length === 1 ? 'is not a fill-in and will print' : 'are not fill-ins and will print'} as
              typed.
            </p>
          )}
          {brackets && <p className="text-sm text-amber-700 dark:text-amber-400">{brackets}</p>}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Colours</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {COLOR_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`color-${key}`}>{label}</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={`${label} picker`}
                      value={/^#[0-9a-f]{6}$/i.test(values.colors[key]) ? values.colors[key] : '#000000'}
                      onChange={(event) => setColor(key, event.target.value)}
                      className="h-9 w-10 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
                    />
                    <Input
                      id={`color-${key}`}
                      value={values.colors[key]}
                      onChange={(event) => setColor(key, event.target.value.trim())}
                      className="font-mono"
                    />
                  </div>
                  {visible[`colors.${key}`] && <p className="text-xs text-destructive">{visible[`colors.${key}`]}</p>}
                </div>
              ))}
            </div>
          </fieldset>

          {serverProblem && (
            <p role="alert" className="text-sm text-destructive">
              {serverProblem}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={submit} disabled={save.isPending || (Boolean(template) && !dirty)}>
              {save.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}
              {template ? 'Save' : 'Create design'}
            </Button>
            {template && dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
            {template && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive">
                    <Trash2 aria-hidden className="size-4" />
                    Delete design
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{template.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Its logos and signatories go with it. A design that a programme uses cannot be deleted.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={destroy}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </section>

        {template ? (
          <>
            <TemplateLogos templateUuid={template.uuid} logos={template.logos} />
            <TemplateSignatories templateUuid={template.uuid} signatories={template.signatories} />
          </>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Create the design first. Then you can add logos and signatories and see the preview.
          </p>
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        {template ? (
          <TemplatePreview
            templateUuid={template.uuid}
            overrides={{
              title: values.title,
              body: values.body,
              colors: problems['colors.primary'] || problems['colors.accent'] || problems['colors.background'] ? undefined : values.colors,
            }}
            version={partsVersion}
          />
        ) : (
          <div className="flex aspect-[1.414/1] items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            The preview appears once the design is created.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
