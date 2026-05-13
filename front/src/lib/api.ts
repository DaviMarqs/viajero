const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000";

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, unknown>;
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, unknown>;

  constructor(message: string, status: number, errors?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiSuccessResponse<T>> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json()) as ApiSuccessResponse<T> | ApiErrorResponse;

  if (!response.ok || !payload.success) {
    throw new ApiError(
      payload.message || "Nao foi possivel completar a solicitacao.",
      response.status,
      "errors" in payload ? payload.errors : undefined,
    );
  }

  return payload;
}

export { API_BASE_URL };
