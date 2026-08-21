/**
 * Common Pagination & Sorting Options
 */

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1> | string;
  select?: string | string[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
