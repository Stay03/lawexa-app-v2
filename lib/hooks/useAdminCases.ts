// Admin Cases - TanStack Query Hooks
// Provides React Query hooks for case management with proper cache management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminCasesApi } from '@/lib/api/admin-cases';
import type {
  AdminCasesParams,
  CreateCaseData,
  UpdateCaseData,
  CreateCountryData,
  CreateCourtData,
  CreateCourseData,
  CreateJudgeData,
  CountriesParams,
  CourtsParams,
  CoursesParams,
  JudgesParams,
} from '@/types/admin-cases';

/******************************************************************************
                            Query Key Factory
******************************************************************************/

export const adminCasesKeys = {
  all: ['admin', 'cases'] as const,

  // Cases
  lists: () => [...adminCasesKeys.all, 'list'] as const,
  list: (params: AdminCasesParams) =>
    [...adminCasesKeys.lists(), params] as const,
  details: () => [...adminCasesKeys.all, 'detail'] as const,
  detail: (slugOrId: string | number) => [...adminCasesKeys.details(), slugOrId] as const,

  // Files
  files: (caseId: number) => [...adminCasesKeys.detail(caseId), 'files'] as const,

  // Autocomplete
  topics: (search: string) => [...adminCasesKeys.all, 'topics', search] as const,
  tags: (search: string) => [...adminCasesKeys.all, 'tags', search] as const,

  // Lookup tables
  countries: () => [...adminCasesKeys.all, 'countries'] as const,
  countriesList: (params: CountriesParams) =>
    [...adminCasesKeys.countries(), 'list', params] as const,

  courts: () => [...adminCasesKeys.all, 'courts'] as const,
  courtsList: (params: CourtsParams) =>
    [...adminCasesKeys.courts(), 'list', params] as const,

  courses: () => [...adminCasesKeys.all, 'courses'] as const,
  coursesList: (params: CoursesParams) =>
    [...adminCasesKeys.courses(), 'list', params] as const,

  judges: () => [...adminCasesKeys.all, 'judges'] as const,
  judgesList: (params: JudgesParams) =>
    [...adminCasesKeys.judges(), 'list', params] as const,
};

/******************************************************************************
                            Cases Query Hooks
******************************************************************************/

/**
 * Get paginated list of cases with filters
 */
export function useCases(params: AdminCasesParams = {}) {
  return useQuery({
    queryKey: adminCasesKeys.list(params),
    queryFn: () => adminCasesApi.getCases(params),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get single case by slug
 */
export function useCase(slug: string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: slug ? adminCasesKeys.detail(slug) : (['admin', 'cases', 'detail', 'undefined'] as const),
    queryFn: () => adminCasesApi.getCase(slug!),
    enabled: !!slug && (options?.enabled !== false),
    staleTime: 60 * 1000, // 1 minute
  });
}

/******************************************************************************
                            Cases Mutation Hooks
******************************************************************************/

/**
 * Create a new case
 */
export function useCreateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCaseData) => adminCasesApi.createCase(data),
    onSuccess: () => {
      // Invalidate all case lists
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.lists() });
    },
  });
}

/**
 * Update an existing case
 */
export function useUpdateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateCaseData }) =>
      adminCasesApi.updateCase(id, data),
    onSuccess: (_response, variables) => {
      // Invalidate specific case detail
      queryClient.invalidateQueries({
        queryKey: adminCasesKeys.detail(variables.id),
      });
      // Invalidate all case lists
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.lists() });
    },
  });
}

/**
 * Delete a case
 */
export function useDeleteCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminCasesApi.deleteCase(id),
    onSuccess: () => {
      // Invalidate all case lists
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.lists() });
    },
  });
}

/**
 * Restore a soft-deleted case
 */
export function useRestoreCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminCasesApi.restoreCase(id),
    onSuccess: (_response, id) => {
      // Invalidate specific case detail
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.detail(id) });
      // Invalidate all case lists
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.lists() });
    },
  });
}

/******************************************************************************
                            Autocomplete Query Hooks
******************************************************************************/

/**
 * Get topic suggestions for autocomplete
 */
export function useCaseTopics(search: string = '') {
  return useQuery({
    queryKey: adminCasesKeys.topics(search),
    queryFn: () => adminCasesApi.getTopics(search),
    staleTime: 5 * 60 * 1000, // 5 minutes (topics don't change often)
    enabled: search.length > 0, // Only fetch when there's a search term
  });
}

/**
 * Get tag suggestions for autocomplete
 */
export function useCaseTags(search: string = '') {
  return useQuery({
    queryKey: adminCasesKeys.tags(search),
    queryFn: () => adminCasesApi.getTags(search),
    staleTime: 5 * 60 * 1000, // 5 minutes (tags don't change often)
    enabled: search.length > 0, // Only fetch when there's a search term
  });
}

/******************************************************************************
                            File Management Hooks
******************************************************************************/

/**
 * Get all files attached to a case
 */
export function useCaseFiles(caseId: number | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: caseId ? adminCasesKeys.files(caseId) : (['admin', 'cases', 'files', 'undefined'] as const),
    queryFn: () => adminCasesApi.getCaseFiles(caseId!),
    enabled: !!caseId && (options?.enabled !== false),
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Upload a file to a case
 */
export function useUploadCaseFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, file }: { caseId: number; file: File }) =>
      adminCasesApi.uploadCaseFile(caseId, file),
    onSuccess: (_response, variables) => {
      // Invalidate files list for this case
      queryClient.invalidateQueries({
        queryKey: adminCasesKeys.files(variables.caseId),
      });
      // Invalidate case detail (to update file count)
      queryClient.invalidateQueries({
        queryKey: adminCasesKeys.detail(variables.caseId),
      });
    },
  });
}

/**
 * Delete a file
 */
export function useDeleteCaseFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fileId, caseId }: { fileId: number; caseId: number }) =>
      adminCasesApi.deleteFile(fileId),
    onSuccess: (_response, variables) => {
      // Invalidate files list for this case
      queryClient.invalidateQueries({
        queryKey: adminCasesKeys.files(variables.caseId),
      });
      // Invalidate case detail (to update file count)
      queryClient.invalidateQueries({
        queryKey: adminCasesKeys.detail(variables.caseId),
      });
    },
  });
}

/******************************************************************************
                            Countries Hooks
******************************************************************************/

/**
 * Get paginated list of countries
 */
export function useCountries(params: CountriesParams = {}) {
  return useQuery({
    queryKey: adminCasesKeys.countriesList(params),
    queryFn: () => adminCasesApi.getCountries(params),
    staleTime: 10 * 60 * 1000, // 10 minutes (countries rarely change)
  });
}

/**
 * Create a new country
 */
export function useCreateCountry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCountryData) => adminCasesApi.createCountry(data),
    onSuccess: () => {
      // Invalidate all country queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.countries() });
    },
  });
}

/**
 * Update an existing country
 */
export function useUpdateCountry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateCountryData> }) =>
      adminCasesApi.updateCountry(id, data),
    onSuccess: () => {
      // Invalidate all country queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.countries() });
    },
  });
}

/**
 * Delete a country
 */
export function useDeleteCountry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminCasesApi.deleteCountry(id),
    onSuccess: () => {
      // Invalidate all country queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.countries() });
    },
  });
}

/******************************************************************************
                            Courts Hooks
******************************************************************************/

/**
 * Get paginated list of courts (with optional country filter)
 */
export function useCourts(params: CourtsParams = {}) {
  return useQuery({
    queryKey: adminCasesKeys.courtsList(params),
    queryFn: () => adminCasesApi.getCourts(params),
    staleTime: 10 * 60 * 1000, // 10 minutes (courts rarely change)
  });
}

/**
 * Create a new court
 */
export function useCreateCourt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCourtData) => adminCasesApi.createCourt(data),
    onSuccess: () => {
      // Invalidate all court queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.courts() });
    },
  });
}

/**
 * Update an existing court
 */
export function useUpdateCourt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateCourtData> }) =>
      adminCasesApi.updateCourt(id, data),
    onSuccess: () => {
      // Invalidate all court queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.courts() });
    },
  });
}

/**
 * Delete a court
 */
export function useDeleteCourt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminCasesApi.deleteCourt(id),
    onSuccess: () => {
      // Invalidate all court queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.courts() });
    },
  });
}

/******************************************************************************
                            Courses Hooks
******************************************************************************/

/**
 * Get paginated list of courses
 */
export function useCourses(params: CoursesParams = {}) {
  return useQuery({
    queryKey: adminCasesKeys.coursesList(params),
    queryFn: () => adminCasesApi.getCourses(params),
    staleTime: 10 * 60 * 1000, // 10 minutes (courses rarely change)
  });
}

/**
 * Create a new course
 */
export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCourseData) => adminCasesApi.createCourse(data),
    onSuccess: () => {
      // Invalidate all course queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.courses() });
    },
  });
}

/**
 * Update an existing course
 */
export function useUpdateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateCourseData> }) =>
      adminCasesApi.updateCourse(id, data),
    onSuccess: () => {
      // Invalidate all course queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.courses() });
    },
  });
}

/**
 * Delete a course
 */
export function useDeleteCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminCasesApi.deleteCourse(id),
    onSuccess: () => {
      // Invalidate all course queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.courses() });
    },
  });
}

/**
 * Restore a soft-deleted course
 */
export function useRestoreCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminCasesApi.restoreCourse(id),
    onSuccess: () => {
      // Invalidate all course queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.courses() });
    },
  });
}

/******************************************************************************
                            Judges Hooks
******************************************************************************/

/**
 * Get paginated list of judges
 */
export function useJudges(params: JudgesParams = {}) {
  return useQuery({
    queryKey: adminCasesKeys.judgesList(params),
    queryFn: () => adminCasesApi.getJudges(params),
    staleTime: 10 * 60 * 1000, // 10 minutes (judges rarely change)
  });
}

/**
 * Create a new judge
 */
export function useCreateJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateJudgeData) => adminCasesApi.createJudge(data),
    onSuccess: () => {
      // Invalidate all judge queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.judges() });
    },
  });
}

/**
 * Update an existing judge
 */
export function useUpdateJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateJudgeData> }) =>
      adminCasesApi.updateJudge(id, data),
    onSuccess: () => {
      // Invalidate all judge queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.judges() });
    },
  });
}

/**
 * Delete a judge
 */
export function useDeleteJudge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminCasesApi.deleteJudge(id),
    onSuccess: () => {
      // Invalidate all judge queries
      queryClient.invalidateQueries({ queryKey: adminCasesKeys.judges() });
    },
  });
}
