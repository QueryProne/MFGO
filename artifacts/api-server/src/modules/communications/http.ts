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

export function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export function asDate(value: unknown): Date | null {
  if (!value) {
    return null;
  }
  const raw = typeof value === "string" ? value : String(value);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function getHeader(reqHeaders: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = reqHeaders[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}
