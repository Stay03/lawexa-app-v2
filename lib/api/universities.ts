import { apiClient } from './client';

export interface University {
  id: number;
  name: string;
  slug: string;
  country_code: string;
  country: string;
  website?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UniversityQueryParams {
  search?: string;
  country_code?: string;
  /** `law_school` returns only law schools (Nigeria's seven campuses, and one
   *  each for Ghana, Kenya and Uganda as of 23 September 2026). */
  type?: 'university' | 'law_school';
  sort?: 'name' | 'created_at';
  order?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
}

export interface UniversityResponse {
  success: boolean;
  message: string;
  data: University[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
  };
  links: {
    first: string;
    last: string;
    prev: string | null;
    next: string | null;
  };
}

/** Rows per page when a whole list is read, and the most pages read (1,000 universities). */
export const UNIVERSITY_PAGE_SIZE = 100;
export const UNIVERSITY_MAX_PAGES = 10;

/** The pages of one list as one answer: every row once, in the server's order. */
export function mergeUniversityPages(pages: readonly UniversityResponse[]): UniversityResponse {
  const [first, ...rest] = pages;
  const seen = new Set<number>();
  const data: University[] = [];
  for (const page of [first, ...rest]) {
    for (const university of page.data) {
      if (seen.has(university.id)) continue;
      seen.add(university.id);
      data.push(university);
    }
  }
  return { ...first, data };
}

/** The page numbers after the first that a list of `lastPage` pages still needs, at most the cap. */
export function remainingUniversityPages(lastPage: number | undefined): number[] {
  const last = Math.min(lastPage ?? 1, UNIVERSITY_MAX_PAGES);
  return Array.from({ length: Math.max(0, last - 1) }, (_, i) => i + 2);
}

export const universityApi = {
  getAll: async (params?: UniversityQueryParams) => {
    const response = await apiClient.get<UniversityResponse>('/universities', {
      params,
    });
    return response.data;
  },

  /**
   * Every university of a list, not only its first page. A country's list was
   * one page of 100 sorted by name, so Nigeria's 167 stopped at the letter T
   * and Topfaith (#136) could be found only by typing (Arthur, 16 November
   * 2026). The first page says how many pages there are; the rest are asked
   * for together.
   */
  getEveryPage: async (params: Omit<UniversityQueryParams, 'page' | 'per_page'>) => {
    const first = await universityApi.getAll({ ...params, per_page: UNIVERSITY_PAGE_SIZE, page: 1 });
    const rest = await Promise.all(
      remainingUniversityPages(first.pagination?.last_page).map((page) =>
        universityApi.getAll({ ...params, per_page: UNIVERSITY_PAGE_SIZE, page }),
      ),
    );
    return mergeUniversityPages([first, ...rest]);
  },

  search: async (search: string, countryCode?: string) => {
    return universityApi.getAll({
      search,
      country_code: countryCode,
      per_page: 20,
      sort: 'name',
      order: 'asc',
    });
  },

  getBySlug: async (slug: string) => {
    const response = await apiClient.get<{ success: boolean; message: string; data: University }>(
      `/universities/${slug}`
    );
    return response.data;
  },
};
