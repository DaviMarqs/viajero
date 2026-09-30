const DEFAULT_API_BASE_URL = "http://localhost:8001";
const ACCESS_TOKEN_KEY = "viajero.access_token";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  errors?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.errors = (payload as { errors?: unknown; })?.errors;
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
  const token = typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  const headers = new Headers(init.headers || {});

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, params), { ...init, headers });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.", 0, error);
  }

  if (!response.ok) {
    let message = response.status === 401
      ? "Sua sessão expirou. Entre novamente para continuar."
      : `Não foi possível concluir a solicitação (erro ${response.status}). Tente novamente.`;
    let payload: unknown;

    try {
      payload = await response.json();
      const errorPayload = payload as { detail?: string; message?: string; };
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

export async function apiRequest<T = unknown>(
  path: string,
  init?: RequestInit,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<T> {
  return apiFetch<T>(path, init, params);
}

export function unwrapListResponse<T>(
  payload:
    | T[]
    | { results?: T[]; data?: T[] | { results?: T[]; items?: T[]; }; items?: T[]; }
    | null
    | undefined,
) {
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

  if ("data" in payload && payload.data && typeof payload.data === "object") {
    if ("results" in payload.data && Array.isArray(payload.data.results)) {
      return payload.data.results;
    }

    if ("items" in payload.data && Array.isArray(payload.data.items)) {
      return payload.data.items;
    }
  }

  if ("items" in payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
}
