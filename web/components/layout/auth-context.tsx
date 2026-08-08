"use client";

import { createContext, useContext } from "react";
import type { AuthUser } from "@/lib/types";

const AuthContext = createContext<AuthUser | null>(null);

export function AuthProvider({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

// Only rendered under app/(app)/layout.tsx, which already redirects to
// /login when there's no session -- safe to assume non-null here.
export function useAuthUser(): AuthUser {
  const user = useContext(AuthContext);
  if (!user) {
    throw new Error("useAuthUser must be used within AuthProvider");
  }
  return user;
}
