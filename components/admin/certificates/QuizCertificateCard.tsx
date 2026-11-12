'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { adminCertificatesApi } from '@/lib/api/certificates';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminChannelQuizKeys } from '@/lib/hooks/useAdminChannelQuizzes';
import { useCertificateProgrammes } from '@/lib/hooks/useAdminCertificates';
import { extractApiError } from '@/lib/utils/api-error';

/**
 * "Comes with a certificate" on a channel quiz (Techlead 60c6e758; WOZ
 * 111315aa): anyone signed in who finishes it, solo or live, is asked for
 * their printed name and then issued that programme's certificate. There is no
 * pass mark. Superadmin only, like the rest of certificates; other admins see
 * nothing here.
 */
export function QuizCertificateCard({
  quizUuid,
  current,
}: {
  quizUuid: string;
  current: { uuid: string; name: string } | null | undefined;
}) {
  const { user } = useAuth();
  if (user?.role !== 'superadmin') return null;
  return <QuizCertificateControls quizUuid={quizUuid} current={current ?? null} />;
}

function QuizCertificateControls({ quizUuid, current }: { quizUuid: string; current: { uuid: string; name: string } | null }) {
  const queryClient = useQueryClient();
  const programmes = useCertificateProgrammes();
  const [on, setOn] = useState(current !== null);
  const [problem, setProblem] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (programmeUuid: string | null) => adminCertificatesApi.setQuizCertificate(quizUuid, programmeUuid),
    meta: { silentError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminChannelQuizKeys.all }),
  });
  const active = (programmes.data ?? []).filter((programme) => programme.is_active || programme.uuid === current?.uuid);

  const link = (programmeUuid: string | null) => {
    setProblem(null);
    save.mutate(programmeUuid, { onError: (cause) => setProblem(extractApiError(cause).message) });
  };

  const toggle = (checked: boolean) => {
    setOn(checked);
    if (!checked && current) link(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Award aria-hidden className="size-4" />
          Certificate
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="quiz-certificate">Comes with a certificate</Label>
            <p className="text-xs text-muted-foreground">
              Everyone signed in who finishes, solo or in a live game, confirms their name and gets the programme’s
              certificate. No pass mark.
            </p>
          </div>
          <Switch id="quiz-certificate" checked={on} disabled={save.isPending} onCheckedChange={toggle} />
        </div>

        {on && (
          <div className="max-w-md space-y-1.5">
            <Label htmlFor="quiz-certificate-programme">Programme</Label>
            <Select value={current?.uuid ?? ''} disabled={save.isPending} onValueChange={(value) => link(value)}>
              <SelectTrigger id="quiz-certificate-programme" className="w-full">
                <SelectValue placeholder={programmes.isPending ? 'Loading programmes…' : 'Pick a programme'} />
              </SelectTrigger>
              <SelectContent>
                {active.map((programme) => (
                  <SelectItem key={programme.uuid} value={programme.uuid}>
                    {programme.name}
                    {programme.is_active ? '' : ' (off)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {programmes.isSuccess && active.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No programme is issuing.{' '}
                <Link href="/admin/certificates/programmes/new" className="underline underline-offset-4">
                  Create one
                </Link>
                .
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {current ? `Linked to ${current.name}.` : 'Not linked yet: nobody gets a certificate until you pick one.'}
              </p>
            )}
          </div>
        )}

        {save.isPending && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
            Saving
          </p>
        )}
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
