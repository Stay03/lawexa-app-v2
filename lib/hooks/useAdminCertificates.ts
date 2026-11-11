'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminCertificatesApi } from '@/lib/api/certificates';
import type {
  CertificateProgrammePayload,
  CertificateTemplatePayload,
  IssueCertificatesPayload,
} from '@/types/certificates';

/******************************************************************************
                              Query key factory
******************************************************************************/

export const certificateKeys = {
  all: ['admin-certificates'] as const,
  templates: () => [...certificateKeys.all, 'templates'] as const,
  template: (uuid: string) => [...certificateKeys.templates(), uuid] as const,
  programmes: () => [...certificateKeys.all, 'programmes'] as const,
  programme: (uuid: string) => [...certificateKeys.programmes(), uuid] as const,
  issued: (uuid: string, page: number) => [...certificateKeys.programme(uuid), 'certificates', page] as const,
};

/******************************************************************************
                                  Queries
******************************************************************************/

export function useCertificateTemplates() {
  return useQuery({
    queryKey: certificateKeys.templates(),
    queryFn: () => adminCertificatesApi.templates(),
    staleTime: 30 * 1000,
  });
}

export function useCertificateTemplate(uuid: string | null) {
  return useQuery({
    queryKey: certificateKeys.template(uuid ?? ''),
    queryFn: () => adminCertificatesApi.template(uuid as string),
    enabled: Boolean(uuid),
    staleTime: 30 * 1000,
  });
}

export function useCertificateProgrammes() {
  return useQuery({
    queryKey: certificateKeys.programmes(),
    queryFn: () => adminCertificatesApi.programmes(),
    staleTime: 30 * 1000,
  });
}

export function useCertificateProgramme(uuid: string | null) {
  return useQuery({
    queryKey: certificateKeys.programme(uuid ?? ''),
    queryFn: () => adminCertificatesApi.programme(uuid as string),
    enabled: Boolean(uuid),
    staleTime: 30 * 1000,
  });
}

export function useIssuedCertificates(programmeUuid: string, page: number) {
  return useQuery({
    queryKey: certificateKeys.issued(programmeUuid, page),
    queryFn: () => adminCertificatesApi.certificates(programmeUuid, page),
    enabled: Boolean(programmeUuid),
    staleTime: 30 * 1000,
  });
}

/******************************************************************************
                                 Mutations
******************************************************************************/

/** Creates a draft or saves an existing template. */
export function useSaveCertificateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, payload }: { uuid: string | null; payload: CertificateTemplatePayload }) =>
      uuid ? adminCertificatesApi.updateTemplate(uuid, payload) : adminCertificatesApi.createTemplate(payload),
    meta: { silentError: true },
    onSuccess: (template) => {
      queryClient.setQueryData(certificateKeys.template(template.uuid), template);
      return queryClient.invalidateQueries({ queryKey: certificateKeys.templates(), exact: true });
    },
  });
}

export function useDeleteCertificateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => adminCertificatesApi.deleteTemplate(uuid),
    meta: { silentError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: certificateKeys.templates() }),
  });
}

/** Logo and signatory changes re-read the template, whose answer carries both lists. */
function useTemplatePartMutation<TInput>(templateUuid: string, run: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    meta: { silentError: true },
    onSettled: () => queryClient.invalidateQueries({ queryKey: certificateKeys.template(templateUuid) }),
  });
}

export function useAddCertificateLogo(templateUuid: string) {
  return useTemplatePartMutation(templateUuid, ({ file, label }: { file: File; label: string }) =>
    adminCertificatesApi.addLogo(templateUuid, file, label),
  );
}

export function useUpdateCertificateLogos(templateUuid: string) {
  return useTemplatePartMutation(templateUuid, (logos: Array<{ uuid: string; label: string; sort: number }>) =>
    Promise.all(logos.map((logo) => adminCertificatesApi.updateLogo(templateUuid, logo.uuid, { label: logo.label, sort: logo.sort }))),
  );
}

export function useDeleteCertificateLogo(templateUuid: string) {
  return useTemplatePartMutation(templateUuid, (logoUuid: string) => adminCertificatesApi.deleteLogo(templateUuid, logoUuid));
}

export function useAddCertificateSignatory(templateUuid: string) {
  return useTemplatePartMutation(templateUuid, (input: { name: string; title: string; signature: File | null }) =>
    adminCertificatesApi.addSignatory(templateUuid, input),
  );
}

export function useUpdateCertificateSignatories(templateUuid: string) {
  return useTemplatePartMutation(
    templateUuid,
    (signatories: Array<{ uuid: string; name: string; title: string; sort: number; signature?: File | null; removeSignature?: boolean }>) =>
      Promise.all(
        signatories.map(({ uuid, ...input }) => adminCertificatesApi.updateSignatory(templateUuid, uuid, input)),
      ),
  );
}

export function useDeleteCertificateSignatory(templateUuid: string) {
  return useTemplatePartMutation(templateUuid, (sigUuid: string) =>
    adminCertificatesApi.deleteSignatory(templateUuid, sigUuid),
  );
}

export function useSaveCertificateProgramme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, payload }: { uuid: string | null; payload: CertificateProgrammePayload }) =>
      uuid ? adminCertificatesApi.updateProgramme(uuid, payload) : adminCertificatesApi.createProgramme(payload),
    meta: { silentError: true },
    onSuccess: (programme) => {
      queryClient.setQueryData(certificateKeys.programme(programme.uuid), programme);
      return queryClient.invalidateQueries({ queryKey: certificateKeys.programmes(), exact: true });
    },
  });
}

export function useDeleteCertificateProgramme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => adminCertificatesApi.deleteProgramme(uuid),
    meta: { silentError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: certificateKeys.programmes() }),
  });
}

export function useIssueCertificates(programmeUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: IssueCertificatesPayload) => adminCertificatesApi.issue(programmeUuid, payload),
    meta: { silentError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: certificateKeys.programme(programmeUuid) }),
  });
}

/** Queues a fresh PDF for every certificate in the programme, after its design changed. */
export function useRerenderCertificateProgramme(programmeUuid: string) {
  return useMutation({
    mutationFn: () => adminCertificatesApi.rerender(programmeUuid),
    meta: { silentError: true },
  });
}
