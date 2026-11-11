'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  programmeFormProblems,
  programmePayload,
  type ProgrammeFormValues,
} from '@/lib/certificates/model';
import {
  useCertificateTemplates,
  useDeleteCertificateProgramme,
  useSaveCertificateProgramme,
} from '@/lib/hooks/useAdminCertificates';
import { extractApiError } from '@/lib/utils/api-error';
import type { CertificateProgramme } from '@/types/certificates';

function initialValues(programme: CertificateProgramme | null): ProgrammeFormValues {
  return programme
    ? {
        name: programme.name,
        templateUuid: programme.template_uuid ?? '',
        partnerName: programme.partner_name ?? '',
        eventDate: programme.event_date?.slice(0, 10) ?? '',
        isActive: programme.is_active,
      }
    : { name: '', templateUuid: '', partnerName: '', eventDate: '', isActive: true };
}

/**
 * A programme: the event a certificate is for, its design and its partner,
 * for example "The Future of Legal Research Is Here", LASU LSS, 15 Nov 2026.
 * While it is switched off, it issues nothing.
 */
export function ProgrammeForm({ programme }: { programme: CertificateProgramme | null }) {
  const router = useRouter();
  const templates = useCertificateTemplates();
  const save = useSaveCertificateProgramme();
  const remove = useDeleteCertificateProgramme();
  const [values, setValues] = useState<ProgrammeFormValues>(() => initialValues(programme));
  const [showProblems, setShowProblems] = useState(false);
  const [serverProblem, setServerProblem] = useState<string | null>(null);

  const problems = useMemo(() => programmeFormProblems(values), [values]);
  const visible = showProblems ? problems : {};
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues(programme));
  const set = <K extends keyof ProgrammeFormValues>(key: K, value: ProgrammeFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = () => {
    setShowProblems(true);
    setServerProblem(null);
    if (Object.keys(problems).length > 0) return;
    save.mutate(
      { uuid: programme?.uuid ?? null, payload: programmePayload(values) },
      {
        onSuccess: (saved) => {
          toast.success(programme ? 'Programme saved' : 'Programme created');
          if (!programme) router.replace(`/admin/certificates/programmes/${saved.uuid}`);
        },
        onError: (cause) => setServerProblem(extractApiError(cause).message),
      },
    );
  };

  const destroy = () => {
    if (!programme) return;
    remove.mutate(programme.uuid, {
      onSuccess: () => {
        toast.success('Programme deleted');
        router.replace('/admin/certificates/programmes');
      },
      onError: (cause) => setServerProblem(extractApiError(cause).message),
    });
  };

  const noTemplates = templates.isSuccess && templates.data.length === 0;

  return (
    <section aria-label="Programme details" className="max-w-2xl space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="programme-name">Programme name</Label>
        <Input
          id="programme-name"
          placeholder="The Future of Legal Research Is Here"
          value={values.name}
          onChange={(event) => set('name', event.target.value)}
          aria-invalid={visible.name ? true : undefined}
          aria-describedby="programme-name-note"
        />
        <p id="programme-name-note" className={visible.name ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {visible.name ?? 'Printed as {programme} on the certificate.'}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="programme-template">Design</Label>
        <Select value={values.templateUuid} onValueChange={(value) => set('templateUuid', value)}>
          <SelectTrigger
            id="programme-template"
            className="w-full"
            aria-invalid={visible.templateUuid ? true : undefined}
            aria-describedby={visible.templateUuid ? 'programme-template-error' : undefined}
          >
            <SelectValue placeholder={templates.isPending ? 'Loading designs…' : 'Pick a design'} />
          </SelectTrigger>
          <SelectContent>
            {(templates.data ?? []).map((template) => (
              <SelectItem key={template.uuid} value={template.uuid}>
                {template.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {noTemplates ? (
          <p className="text-xs text-muted-foreground">
            There are no designs yet.{' '}
            <Link href="/admin/certificates/templates/new" className="underline underline-offset-4">
              Create one first
            </Link>
            .
          </p>
        ) : (
          visible.templateUuid && (
            <p id="programme-template-error" className="text-xs text-destructive">
              {visible.templateUuid}
            </p>
          )
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="programme-partner">Partner</Label>
          <Input
            id="programme-partner"
            placeholder="the LASU Law Students’ Society"
            value={values.partnerName}
            onChange={(event) => set('partnerName', event.target.value)}
            aria-describedby="programme-partner-hint"
          />
          <p id="programme-partner-hint" className="text-xs text-muted-foreground">
            Optional. Write it as it reads in a sentence: the Law Students’ Society. The gold line at the top prints
            it in capitals.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="programme-date">Event date</Label>
          <Input
            id="programme-date"
            type="date"
            value={values.eventDate}
            onChange={(event) => set('eventDate', event.target.value)}
            aria-invalid={visible.eventDate ? true : undefined}
            aria-describedby={visible.eventDate ? 'programme-date-error' : undefined}
          />
          {visible.eventDate && (
            <p id="programme-date-error" className="text-xs text-destructive">
              {visible.eventDate}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div>
          <Label htmlFor="programme-active">Issuing certificates</Label>
          <p className="text-xs text-muted-foreground">Switch off to stop new certificates. Issued ones stay valid.</p>
        </div>
        <Switch id="programme-active" checked={values.isActive} onCheckedChange={(checked) => set('isActive', checked)} />
      </div>

      {serverProblem && (
        <p role="alert" className="text-sm text-destructive">
          {serverProblem}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={submit} disabled={save.isPending || (Boolean(programme) && !dirty)}>
          {save.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Save aria-hidden className="size-4" />}
          {programme ? 'Save' : 'Create programme'}
        </Button>
        {programme && dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        {programme && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive">
                <Trash2 aria-hidden className="size-4" />
                Delete programme
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{programme.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  A programme that has issued certificates cannot be deleted. Switch it off instead.
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
  );
}
