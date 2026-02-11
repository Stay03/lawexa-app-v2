// Admin Cases - API Service Layer
// Handles all API calls for case management

import { apiClient } from './client';
import type {
  ApiResponse,
  PaginatedResponse,
  CaseDetail,
  CaseSummary,
  Country,
  Court,
  Course,
  Judge,
  CaseFile,
  CreateCaseData,
  UpdateCaseData,
  CreateCountryData,
  CreateCourtData,
  CreateCourseData,
  CreateJudgeData,
  AdminCasesParams,
  CountriesParams,
  CourtsParams,
  CoursesParams,
  JudgesParams,
} from '@/types/admin-cases';

/******************************************************************************
                                Cases CRUD
******************************************************************************/

/**
 * Get paginated list of cases with filters
 */
async function getCases(
  params: AdminCasesParams = {}
): Promise<PaginatedResponse<CaseSummary>> {
  const response = await apiClient.get<PaginatedResponse<CaseSummary>>(
    '/cases',
    { params }
  );
  return response.data;
}

/**
 * Get single case by slug with all relationships
 */
async function getCase(slug: string): Promise<ApiResponse<CaseDetail>> {
  const response = await apiClient.get<ApiResponse<CaseDetail>>(
    `/cases/${slug}`
  );
  return response.data;
}

/**
 * Create a new case
 */
async function createCase(
  data: CreateCaseData
): Promise<ApiResponse<CaseDetail>> {
  const response = await apiClient.post<ApiResponse<CaseDetail>>(
    '/cases',
    data
  );
  return response.data;
}

/**
 * Update an existing case
 */
async function updateCase(
  id: number,
  data: UpdateCaseData
): Promise<ApiResponse<CaseDetail>> {
  const response = await apiClient.put<ApiResponse<CaseDetail>>(
    `/cases/${id}`,
    data
  );
  return response.data;
}

/**
 * Soft-delete a case
 */
async function deleteCase(id: number): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/cases/${id}`);
  return response.data;
}

/**
 * Restore a soft-deleted case (Admin only)
 */
async function restoreCase(id: number): Promise<ApiResponse<CaseDetail>> {
  const response = await apiClient.post<ApiResponse<CaseDetail>>(
    `/cases/${id}/restore`
  );
  return response.data;
}

/******************************************************************************
                                Autocomplete
******************************************************************************/

/**
 * Search distinct topic values from existing cases
 * @param search - Partial match filter (case-insensitive)
 * @returns Array of topic strings (max 20)
 */
async function getTopics(search?: string): Promise<ApiResponse<string[]>> {
  const response = await apiClient.get<ApiResponse<string[]>>(
    '/case-topics',
    { params: { search } }
  );
  return response.data;
}

/**
 * Search distinct tag values from existing cases
 * @param search - Partial match filter (case-insensitive)
 * @returns Array of tag strings (max 20)
 */
async function getTags(search?: string): Promise<ApiResponse<string[]>> {
  const response = await apiClient.get<ApiResponse<string[]>>('/case-tags', {
    params: { search },
  });
  return response.data;
}

/******************************************************************************
                                File Management
******************************************************************************/

/**
 * Get all files attached to a case
 */
async function getCaseFiles(
  caseId: number
): Promise<ApiResponse<CaseFile[]>> {
  const response = await apiClient.get<ApiResponse<CaseFile[]>>(
    `/cases/${caseId}/files`
  );
  return response.data;
}

/**
 * Upload a file to a case
 */
async function uploadCaseFile(
  caseId: number,
  file: File
): Promise<ApiResponse<CaseFile>> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<ApiResponse<CaseFile>>(
    `/cases/${caseId}/files`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

/**
 * Delete a file
 */
async function deleteFile(fileId: number): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/files/${fileId}`
  );
  return response.data;
}

/**
 * Get download URL for a file (trigger download)
 */
function getFileDownloadUrl(fileId: number): string {
  return `/api/files/${fileId}/download`;
}

/******************************************************************************
                                Countries
******************************************************************************/

/**
 * Get paginated list of countries
 */
async function getCountries(
  params: CountriesParams = {}
): Promise<PaginatedResponse<Country>> {
  const response = await apiClient.get<PaginatedResponse<Country>>(
    '/countries',
    { params }
  );
  return response.data;
}

/**
 * Create a new country
 */
async function createCountry(
  data: CreateCountryData
): Promise<ApiResponse<Country>> {
  const response = await apiClient.post<ApiResponse<Country>>(
    '/countries',
    data
  );
  return response.data;
}

/**
 * Update an existing country
 */
async function updateCountry(
  id: number,
  data: Partial<CreateCountryData>
): Promise<ApiResponse<Country>> {
  const response = await apiClient.put<ApiResponse<Country>>(
    `/countries/${id}`,
    data
  );
  return response.data;
}

/**
 * Delete a country
 */
async function deleteCountry(id: number): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/countries/${id}`
  );
  return response.data;
}

/******************************************************************************
                                Courts
******************************************************************************/

/**
 * Get paginated list of courts (with country filter)
 */
async function getCourts(
  params: CourtsParams = {}
): Promise<PaginatedResponse<Court>> {
  const response = await apiClient.get<PaginatedResponse<Court>>('/courts', {
    params,
  });
  return response.data;
}

/**
 * Create a new court
 */
async function createCourt(
  data: CreateCourtData
): Promise<ApiResponse<Court>> {
  const response = await apiClient.post<ApiResponse<Court>>('/courts', data);
  return response.data;
}

/**
 * Update an existing court
 */
async function updateCourt(
  id: number,
  data: Partial<CreateCourtData>
): Promise<ApiResponse<Court>> {
  const response = await apiClient.put<ApiResponse<Court>>(
    `/courts/${id}`,
    data
  );
  return response.data;
}

/**
 * Delete a court
 */
async function deleteCourt(id: number): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/courts/${id}`);
  return response.data;
}

/******************************************************************************
                                Courses
******************************************************************************/

/**
 * Get paginated list of courses
 */
async function getCourses(
  params: CoursesParams = {}
): Promise<PaginatedResponse<Course>> {
  const response = await apiClient.get<PaginatedResponse<Course>>('/courses', {
    params,
  });
  return response.data;
}

/**
 * Get a single course by slug
 */
async function getCourse(slug: string): Promise<ApiResponse<Course>> {
  const response = await apiClient.get<ApiResponse<Course>>(
    `/courses/${slug}`
  );
  return response.data;
}

/**
 * Create a new course
 */
async function createCourse(
  data: CreateCourseData
): Promise<ApiResponse<Course>> {
  const response = await apiClient.post<ApiResponse<Course>>('/courses', data);
  return response.data;
}

/**
 * Update an existing course
 */
async function updateCourse(
  id: number,
  data: Partial<CreateCourseData>
): Promise<ApiResponse<Course>> {
  const response = await apiClient.put<ApiResponse<Course>>(
    `/courses/${id}`,
    data
  );
  return response.data;
}

/**
 * Soft-delete a course
 */
async function deleteCourse(id: number): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(
    `/courses/${id}`
  );
  return response.data;
}

/**
 * Restore a soft-deleted course
 */
async function restoreCourse(id: number): Promise<ApiResponse<Course>> {
  const response = await apiClient.post<ApiResponse<Course>>(
    `/courses/${id}/restore`
  );
  return response.data;
}

/******************************************************************************
                                Judges
******************************************************************************/

/**
 * Get paginated list of judges
 */
async function getJudges(
  params: JudgesParams = {}
): Promise<PaginatedResponse<Judge>> {
  const response = await apiClient.get<PaginatedResponse<Judge>>('/judges', {
    params,
  });
  return response.data;
}

/**
 * Create a new judge
 */
async function createJudge(
  data: CreateJudgeData
): Promise<ApiResponse<Judge>> {
  const response = await apiClient.post<ApiResponse<Judge>>('/judges', data);
  return response.data;
}

/**
 * Update an existing judge
 */
async function updateJudge(
  id: number,
  data: Partial<CreateJudgeData>
): Promise<ApiResponse<Judge>> {
  const response = await apiClient.put<ApiResponse<Judge>>(
    `/judges/${id}`,
    data
  );
  return response.data;
}

/**
 * Delete a judge
 */
async function deleteJudge(id: number): Promise<ApiResponse<null>> {
  const response = await apiClient.delete<ApiResponse<null>>(`/judges/${id}`);
  return response.data;
}

/******************************************************************************
                                Export default
******************************************************************************/

export const adminCasesApi = {
  // Cases
  getCases,
  getCase,
  createCase,
  updateCase,
  deleteCase,
  restoreCase,

  // Autocomplete
  getTopics,
  getTags,

  // Files
  getCaseFiles,
  uploadCaseFile,
  deleteFile,
  getFileDownloadUrl,

  // Countries
  getCountries,
  createCountry,
  updateCountry,
  deleteCountry,

  // Courts
  getCourts,
  createCourt,
  updateCourt,
  deleteCourt,

  // Courses
  getCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  restoreCourse,

  // Judges
  getJudges,
  createJudge,
  updateJudge,
  deleteJudge,
};
