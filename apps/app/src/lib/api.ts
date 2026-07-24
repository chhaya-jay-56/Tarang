"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function buildApiError(res: Response): Promise<Error> {
  let detail = res.statusText || "Request failed";

  try {
    const body = await res.clone().json();
    if (typeof body?.detail === "string") {
      detail = body.detail;
    }
  } catch {
    try {
      const text = await res.clone().text();
      if (text) detail = text;
    } catch {
      // Keep the HTTP status text when the response body is not readable.
    }
  }

  return new Error(`API ${res.status}: ${detail}`);
}

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
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!isLoaded) {
        throw new Error("Clerk auth is still loading");
      }

      if (!isSignedIn) {
        throw new Error("No signed-in Clerk session");
      }

      const token = await getToken();
      if (!token) {
        throw new Error("Clerk did not return an API token");
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        ...options.headers as Record<string, string>,
      };

      // Only set application/json if not uploading FormData directly
      if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      } else if (options.body instanceof FormData && headers["Content-Type"] === "application/json") {
         delete headers["Content-Type"]; // let browser handle multipart boundaries naturally
      }

      const res = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        throw await buildApiError(res);
      }

      return res;
    },
    [getToken, isLoaded, isSignedIn]
  );

  const getAuthToken = useCallback(async () => {
    return await getToken();
  }, [getToken]);

  return { authFetch, getAuthToken };
}
