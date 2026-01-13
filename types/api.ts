export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  errors?: Record<string, string[]> | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: {
    items: T[];
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  };
}
