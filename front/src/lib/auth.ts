import { apiRequest } from "./api";

const ACCESS_TOKEN_KEY = "viajero.access_token";
const REFRESH_TOKEN_KEY = "viajero.refresh_token";
const USER_KEY = "viajero.user";

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  display_name: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  home_airport: string | null;
  preferred_currency: string | null;
  is_profile_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthPayload {
  access: string;
  refresh: string;
  user: AuthUser;
}

export const GUEST_USER: AuthUser = {
  id: 0,
  email: "visitante@viajero.local",
  username: "visitante",
  display_name: "Visitante",
  first_name: "Visitante",
  last_name: "",
  avatar_url: null,
  home_airport: null,
  preferred_currency: "BRL",
  is_profile_complete: false,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
  first_name: string;
  last_name: string;
}

export function persistAuth(payload: AuthPayload) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.access);
  localStorage.setItem(REFRESH_TOKEN_KEY, payload.refresh);
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);

  if (!raw) {
    return GUEST_USER;
  }

  try {
    return {
      ...GUEST_USER,
      ...JSON.parse(raw),
    } as AuthUser;
  } catch {
    return GUEST_USER;
  }
}

export function persistGuestUser(user: Partial<AuthUser>) {
  const nextUser = {
    ...getStoredUser(),
    ...user,
    id: 0,
    updated_at: new Date().toISOString(),
  } satisfies AuthUser;

  localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  return nextUser;
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY));
}

export async function login(input: LoginInput) {
  const response = await apiRequest<AuthPayload>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify(input),
  });

  persistAuth(response.data);
  return response;
}

export async function register(input: RegisterInput) {
  const response = await apiRequest<AuthPayload>("/api/auth/register/", {
    method: "POST",
    body: JSON.stringify(input),
  });

  persistAuth(response.data);
  return response;
}
