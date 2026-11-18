// Shared response types from docs/specs/api-contract.md §3.

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Error body returned by the backend for every failed request. */
export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

/**
 * Error as seen by the app after normalization (utils/errorMessages.ts):
 * a friendly Spanish message plus per-field messages when the backend sent them.
 * It is a plain object so it can travel in Redux actions.
 */
export interface AppError {
  /** HTTP status, or null when the server could not be reached. */
  status: number | null;
  message: string;
  fieldErrors: Record<string, string>;
  /** True when the HTTP client already reacted (e.g. expired session). */
  handled: boolean;
}
