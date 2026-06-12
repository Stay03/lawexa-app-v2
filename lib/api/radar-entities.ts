import { apiClient } from './client';
import { casesApi } from './cases';
import { notesApi } from './notes';
import { statutesApi } from './statutes';
import type { PaginatedResponse } from '@/types/api';
import type { Court, Judge } from '@/types/admin-cases';
import type { RadarEntityOption, RadarEntityType } from '@/types/radar';

const SEARCH_PAGE_SIZE = 10;

async function searchCases(search: string): Promise<RadarEntityOption[]> {
  const response = await casesApi.getList({ search, per_page: SEARCH_PAGE_SIZE });
  return response.data.map((item) => ({
    entity_type: 'case',
    entity_id: item.id,
    label: item.title,
    sublabel: item.citation ?? item.court?.name ?? undefined,
  }));
}

async function searchStatutes(search: string): Promise<RadarEntityOption[]> {
  const response = await statutesApi.getList({ search, per_page: SEARCH_PAGE_SIZE });
  return response.data.map((item) => ({
    entity_type: 'statute',
    entity_id: item.id,
    label: item.title,
    sublabel: [item.country?.name, item.year].filter(Boolean).join(' · ') || undefined,
  }));
}

async function searchNotes(search: string): Promise<RadarEntityOption[]> {
  const response = await notesApi.getList({ search, per_page: SEARCH_PAGE_SIZE });
  return response.data.map((item) => ({
    entity_type: 'note',
    entity_id: item.id,
    label: item.title,
    sublabel: item.user.name,
  }));
}

async function searchCourts(search: string): Promise<RadarEntityOption[]> {
  const response = await apiClient.get<PaginatedResponse<Court>>('/courts', {
    params: { search, per_page: SEARCH_PAGE_SIZE },
  });
  return response.data.data.items.map((item) => ({
    entity_type: 'court',
    entity_id: item.id,
    label: item.name,
    sublabel: item.country?.name ?? undefined,
  }));
}

async function searchJudges(search: string): Promise<RadarEntityOption[]> {
  const response = await apiClient.get<PaginatedResponse<Judge>>('/judges', {
    params: { search, per_page: SEARCH_PAGE_SIZE },
  });
  return response.data.data.items.map((item) => ({
    entity_type: 'judge',
    entity_id: item.id,
    label: item.name,
  }));
}

/**
 * Search Lawexa records watchable by a radar, normalized to picker options.
 */
export function searchRadarEntities(
  type: RadarEntityType,
  search: string
): Promise<RadarEntityOption[]> {
  switch (type) {
    case 'case':
      return searchCases(search);
    case 'statute':
      return searchStatutes(search);
    case 'court':
      return searchCourts(search);
    case 'judge':
      return searchJudges(search);
    case 'note':
      return searchNotes(search);
  }
}
