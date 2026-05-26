const DEFAULT_API_BASE_URL = "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  errors?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.errors = (payload as { errors?: unknown })?.errors;
  }
}

export interface ApiSuccessResponse<T> extends Record<string, unknown> {
  data?: T;
  results?: unknown;
  items?: unknown;
  message?: string;
  detail?: string;
  success?: boolean;
  errors?: unknown;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  return trimTrailingSlash(configured?.trim() || DEFAULT_API_BASE_URL);
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, `${getApiBaseUrl()}/`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  const response = await fetch(buildUrl(path, params), {
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let payload: unknown;

    try {
      payload = await response.json();
      const errorPayload = payload as { detail?: string; message?: string };
      message = errorPayload.detail || errorPayload.message || message;
    } catch {
      // Keep fallback message when the server does not return JSON.
    }

    throw new ApiError(message, response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<any> {
  return apiFetch<T>(path, init, params);
}

export function unwrapListResponse<T>(payload: T[] | { results?: T[]; data?: T[]; items?: T[] } | null | undefined) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload) {
    return [];
  }

  if ("results" in payload && Array.isArray(payload.results)) {
    return payload.results;
  }

  if ("data" in payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  if ("items" in payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}
