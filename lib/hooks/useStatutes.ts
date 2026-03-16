'use client';

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { statutesApi } from '@/lib/api/statutes';
import type { StatuteListParams } from '@/types/statute';

// Query keys factory
export const statuteKeys = {
  all: ['statutes'] as const,
  lists: () => [...statuteKeys.all, 'list'] as const,
  list: (params: StatuteListParams) => [...statuteKeys.lists(), params] as const,
  details: () => [...statuteKeys.all, 'detail'] as const,
  detail: (slug: string) => [...statuteKeys.details(), slug] as const,
  nodes: (slug: string) => [...statuteKeys.all, 'nodes', slug] as const,
  akn: (slug: string) => [...statuteKeys.all, 'akn', slug] as const,
};

/**
 * Hook for fetching infinite scrolling statute list
 */
export function useInfiniteStatutes(params: Omit<StatuteListParams, 'page'> = {}) {
  return useInfiniteQuery({
    queryKey: [...statuteKeys.lists(), 'infinite', params] as const,
    queryFn: ({ pageParam }) => statutesApi.getList({ ...params, page: pageParam }),
    getNextPageParam: (lastPage) => {
      const { current_page, last_page } = lastPage.pagination;
      return current_page < last_page ? current_page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook for fetching single statute by slug
 */
export function useStatute(slug: string) {
  return useQuery({
    queryKey: statuteKeys.detail(slug),
    queryFn: () => statutesApi.getBySlug(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for fetching all nodes of a statute.
 * Loads all nodes in a single request (from=0, to=totalCount-1).
 */
export function useStatuteNodes(slug: string, totalCount: number) {
  return useQuery({
    queryKey: statuteKeys.nodes(slug),
    queryFn: () => statutesApi.getNodes(slug, 0, Math.max(totalCount - 1, 0)),
    enabled: !!slug && totalCount > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for fetching statute AKN XML export.
 * Returns the raw XML string for client-side parsing and rendering.
 */
export function useStatuteAkn(slug: string) {
  return useQuery({
    queryKey: statuteKeys.akn(slug),
    queryFn: () => statutesApi.exportAkn(slug),
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
