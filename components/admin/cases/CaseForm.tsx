'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Form } from '@/components/ui/form';

import { CaseFormBasicInfo } from './CaseFormBasicInfo';
import { CaseFormLegalInfo } from './CaseFormLegalInfo';
import { CaseFormCourtInfo } from './CaseFormCourtInfo';
import { CaseFormRelationships } from './CaseFormRelationships';
import { CaseFormFullReport } from './CaseFormFullReport';
import { CaseFormFiles } from './CaseFormFiles';
import { CountryQuickAddDialog } from './CountryQuickAddDialog';
import { CourtQuickAddDialog } from './CourtQuickAddDialog';
import { CourseQuickAddDialog } from './CourseQuickAddDialog';

import { useCase, useCreateCase, useUpdateCase } from '@/lib/hooks/useAdminCases';
import { extractApiError } from '@/lib/utils/api-error';
import { caseFormSchema, type CaseFormValues } from '@/lib/validations/admin-cases';
import type { Country, Court, Course } from '@/types/admin-cases';

/******************************************************************************
                                Component Props
******************************************************************************/

interface CaseFormProps {
  caseSlug?: string;
  mode: 'create' | 'edit';
}

/******************************************************************************
                                Main Component
******************************************************************************/

/**
 * Main case form component for creating and editing cases
 * Follows the workflow create page pattern with Card-based sections
 */
export function CaseForm({ caseSlug, mode }: CaseFormProps) {
  const router = useRouter();
  const isEditMode = mode === 'edit';

  // Fetch case data for edit mode
  const { data: caseData, isLoading: isCaseLoading } = useCase(caseSlug, {
    enabled: isEditMode && !!caseSlug,
  });

  // Extract case ID for mutations (needed for update)
  const caseId = caseData?.data?.id;

  // Mutations
  const createMutation = useCreateCase();
  const updateMutation = useUpdateCase();

  // Quick-add dialog states
  const [countryDialogOpen, setCountryDialogOpen] = useState(false);
  const [courtDialogOpen, setCourtDialogOpen] = useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);

  // Form setup
  const form = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues: {
      title: '',
      body: '',
      course_id: null,
      topic: null,
      tags: [],
      level: null,
      principles: null,
      judicial_precedent: null,
      country_id: null,
      court_id: null,
      judgment_date: null,
      judge_ids: [],
      similar_case_ids: [],
      cited_case_ids: [],
      full_report: null,
    },
  });

  // Populate form with existing data in edit mode
  useEffect(() => {
    if (isEditMode && caseData?.data) {
      const caseDetail = caseData.data;
      form.reset({
        title: caseDetail.title,
        body: caseDetail.body || '',
        course_id: caseDetail.course?.id || null,
        topic: caseDetail.topic || null,
        tags: caseDetail.tags || [],
        level: caseDetail.level || null,
        principles: caseDetail.principles || null,
        judicial_precedent: caseDetail.judicial_precedent || null,
        country_id: caseDetail.country?.id || null,
        court_id: caseDetail.court?.id || null,
        judgment_date: caseDetail.judgment_date || null,
        judge_ids: caseDetail.judges?.map((j) => j.id) || [],
        similar_case_ids: caseDetail.similar_cases?.map((c) => c.id) || [],
        cited_case_ids: caseDetail.cited_cases?.map((c) => c.id) || [],
        full_report: caseDetail.full_report?.full_text || null,
      });
    }
  }, [isEditMode, caseData, form]);

  // Submit handler
  const onSubmit = (data: CaseFormValues) => {
    // Transform form data to API payload format
    const payload = {
      ...data,
      // Convert null to undefined for optional fields
      course_id: data.course_id || undefined,
      topic: data.topic || undefined,
      tags: data.tags?.length ? data.tags : undefined,
      level: data.level || undefined,
      principles: data.principles || undefined,
      judicial_precedent: data.judicial_precedent || undefined,
      country_id: data.country_id || undefined,
      court_id: data.court_id || undefined,
      judgment_date: data.judgment_date || undefined,
      judge_ids: data.judge_ids?.length ? data.judge_ids : undefined,
      similar_case_ids: data.similar_case_ids?.length
        ? data.similar_case_ids
        : undefined,
      cited_case_ids: data.cited_case_ids?.length
        ? data.cited_case_ids
        : undefined,
      full_report: data.full_report || undefined,
    };

    const mutation = isEditMode ? updateMutation : createMutation;
    const mutationPayload = isEditMode ? { id: caseId!, data: payload } : payload;

    mutation.mutate(mutationPayload as any, {
      onSuccess: (response) => {
        toast.success(response.message);
        // Navigate to case detail page
        router.push(`/admin/cases/${response.data.id}`);
      },
      onError: (error) => {
        const apiError = extractApiError(error);

        // Set field-level errors
        if (apiError.errors) {
          Object.entries(apiError.errors).forEach(([field, messages]) => {
            form.setError(field as keyof CaseFormValues, {
              message: messages[0],
            });
          });
        } else {
          toast.error(apiError.message);
        }
      },
    });
  };

  // Quick-add success handlers
  const handleCountryCreated = (country: Country) => {
    form.setValue('country_id', country.id);
    toast.success('Country created and selected');
  };

  const handleCourtCreated = (court: Court) => {
    form.setValue('court_id', court.id);
    toast.success('Court created and selected');
  };

  const handleCourseCreated = (course: Course) => {
    form.setValue('course_id', course.id);
    toast.success('Course created and selected');
  };

  // Loading state for edit mode
  if (isEditMode && isCaseLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Case not found in edit mode
  if (isEditMode && !isCaseLoading && !caseData?.data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Case not found</p>
      </div>
    );
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Card 1: Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Enter the case title, body, and core categorization details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CaseFormBasicInfo
                form={form}
                courseDialogOpen={courseDialogOpen}
                setCourseDialogOpen={setCourseDialogOpen}
              />
            </CardContent>
          </Card>

          {/* Card 2: Legal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Legal Information</CardTitle>
              <CardDescription>
                Document the legal principles and precedents involved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CaseFormLegalInfo form={form} />
            </CardContent>
          </Card>

          {/* Card 3: Court Information */}
          <Card>
            <CardHeader>
              <CardTitle>Court Information</CardTitle>
              <CardDescription>
                Specify the court, jurisdiction, date, and presiding judges.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CaseFormCourtInfo
                form={form}
                countryDialogOpen={countryDialogOpen}
                setCountryDialogOpen={setCountryDialogOpen}
                courtDialogOpen={courtDialogOpen}
                setCourtDialogOpen={setCourtDialogOpen}
              />
            </CardContent>
          </Card>

          {/* Card 4: Related Cases */}
          <Card>
            <CardHeader>
              <CardTitle>Related Cases</CardTitle>
              <CardDescription>
                Link similar cases and cases that are formally cited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CaseFormRelationships form={form} currentCaseId={caseId} />
            </CardContent>
          </Card>

          {/* Card 5: Full Report */}
          <Card>
            <CardHeader>
              <CardTitle>Full Report</CardTitle>
              <CardDescription>
                Optional detailed case report with formatted text.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CaseFormFullReport form={form} />
            </CardContent>
          </Card>

          {/* Card 6: Files (Edit Mode Only) */}
          {isEditMode && caseId && (
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
                <CardDescription>
                  Upload supporting documents and files (max 10 files, 20MB each).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CaseFormFiles caseId={caseId} />
              </CardContent>
            </Card>
          )}

          {/* Create Mode - File Upload Notice */}
          {!isEditMode && (
            <Card>
              <CardHeader>
                <CardTitle>Attachments</CardTitle>
                <CardDescription>
                  File uploads will be available after creating the case.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Save the case first, then you can attach files from the edit page.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditMode ? 'Save Changes' : 'Create Case'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Quick-Add Dialogs */}
      <CountryQuickAddDialog
        open={countryDialogOpen}
        onOpenChange={setCountryDialogOpen}
        onSuccess={handleCountryCreated}
      />

      <CourtQuickAddDialog
        open={courtDialogOpen}
        onOpenChange={setCourtDialogOpen}
        onSuccess={handleCourtCreated}
        preSelectedCountryId={form.watch('country_id')}
      />

      <CourseQuickAddDialog
        open={courseDialogOpen}
        onOpenChange={setCourseDialogOpen}
        onSuccess={handleCourseCreated}
      />
    </>
  );
}
