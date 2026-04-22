"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Hook that returns an authenticated fetch wrapper.
 *
 * Automatically attaches the Clerk JWT as a Bearer token
 * to every request sent to the FastAPI backend.
 *
 * @example
 * ```tsx
 * const { authFetch } = useApiClient();
 *
 * const voices = await authFetch("/api/voices");
 * const data = await voices.json();
 * ```
 */
export function useApiClient() {
  const { getToken } = useAuth();

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = await getToken();

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "ngrok-skip-browser-warning": "true",
        ...options.headers as Record<string, string>,
      };

      // Only set application/json if not uploading FormData directly
      if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      } else if (options.body instanceof FormData && headers["Content-Type"] === "application/json") {
         delete headers["Content-Type"]; // let browser handle multipart boundries naturally
      }

      return fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
        credentials: "include",
      });
    },
    [getToken]
  );

  return { authFetch };
}
