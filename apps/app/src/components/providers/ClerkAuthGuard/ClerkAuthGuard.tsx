"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingScreen } from "@/components/ui/LoadingScreen/LoadingScreen";

/**
 * Client-side auth guard for the dashboard route group.
 *
 * Handles three states:
 *  1. Clerk still loading (initial hydration / background tab return) → LoadingScreen
 *  2. User signed out (post-logout, direct URL access) → redirect to /sign-in
 *  3. User signed in → render children
 *
 * This prevents blank screens after login/signup and provides a smooth
 * loading animation during auth transitions (login, logout, tab switch).
 */
export function ClerkAuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Once Clerk has loaded and user is NOT signed in, redirect to sign-in
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  // Clerk hasn't loaded yet — show loading animation
  if (!isLoaded) {
    return <LoadingScreen />;
  }

  // User is signed out — show loading while redirect happens
  if (!isSignedIn) {
    return <LoadingScreen />;
  }

  // Authenticated — render dashboard
  return <>{children}</>;
}
