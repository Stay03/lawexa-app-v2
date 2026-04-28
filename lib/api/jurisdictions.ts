import { apiClient } from './client';
import type { Jurisdiction, JurisdictionsResponse } from '@/types/jurisdiction';

export const jurisdictionsApi = {
  list: async (): Promise<Jurisdiction[]> => {
    const response = await apiClient.get<JurisdictionsResponse>(
      '/countries/jurisdictions'
    );
    return response.data.data;
  },
};
