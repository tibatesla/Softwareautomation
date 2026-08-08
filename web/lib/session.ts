import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, USER_COOKIE } from "@/lib/cookie-names";
import type { AuthUser } from "@/lib/types";

export type SessionUser = AuthUser;

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // matches the backend's JWT_EXPIRES_IN (8h)

// `next start` always runs with NODE_ENV=production internally, regardless of
// what's in .env.local -- so defaulting `secure` to NODE_ENV==='production'
// silently breaks login on any production deploy that isn't yet behind TLS
// (the browser drops a Secure cookie sent over plain HTTP). COOKIE_SECURE
// lets a specific deployment opt out explicitly (set "false") until TLS is
// in place, while still defaulting to secure-by-default everywhere else.
const cookieSecure = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === "true"
  : process.env.NODE_ENV === "production";

export async function setSession(token: string, user: SessionUser): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  // Not httpOnly: carries no secret (no token), only drives client-side nav/UI role gating.
  cookieStore.set(USER_COOKIE, encodeURIComponent(JSON.stringify(user)), {
    httpOnly: false,
    secure: cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(USER_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(USER_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(decodeURIComponent(raw)) as SessionUser;
  } catch {
    return null;
  }
}
