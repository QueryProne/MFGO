export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(query: Record<string, unknown>, defaults?: { page?: number; limit?: number }): PaginationParams {
  const defaultPage = defaults?.page ?? 1;
  const defaultLimit = defaults?.limit ?? 25;

  const parsedPage = Number(query.page ?? defaultPage);
  const parsedLimit = Number(query.limit ?? defaultLimit);

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : defaultPage;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), 200) : defaultLimit;

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

export function parseDateParam(raw: unknown, fallback?: Date | null): Date | null {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return fallback ?? null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return fallback ?? null;
  }
  return parsed;
}
