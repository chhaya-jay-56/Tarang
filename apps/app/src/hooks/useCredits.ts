"use client";

import { useApiClient } from "@/lib/api";
import { useState, useEffect, useRef, useCallback } from "react";

interface CreditData {
  creditBalance: number;
  planType: string;
  planCreditsTotal: number;
}

// PLAN_TOTALS removed — credit_limit now comes from the backend per-user.
// Fallback to 1500 if credit_limit is 0 (legacy users before migration).
const DEFAULT_CREDIT_LIMIT = 1500;

let globalCreditData: CreditData | null = null;
let activeFetchPromise: Promise<void> | null = null;
let globalLastFetchTime = 0;
const STALE_MS = 30_000;

export function useCredits() {
  const { authFetch } = useApiClient();
  const [data, setData] = useState<CreditData | null>(globalCreditData);
  const [isLoading, setIsLoading] = useState(!globalCreditData);
  const [error, setError] = useState<string | null>(null);

  const fetchCredits = useCallback(async (force = false) => {
    const now = Date.now();
    
    if (!force && now - globalLastFetchTime < STALE_MS && globalCreditData) {
      setData(globalCreditData);
      setIsLoading(false);
      return;
    }

    if (activeFetchPromise && !force) {
      setIsLoading(true);
      await activeFetchPromise;
      setData(globalCreditData);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    activeFetchPromise = (async () => {
      try {
        const res = await authFetch("/api/credits/balance");
        if (!res.ok) throw new Error("Failed to fetch credits");

        const json = await res.json();
        const planType = json.plan_type || "free";

        const creditLimit = json.credit_limit ?? 0;

        globalCreditData = {
          creditBalance: json.credit_balance ?? 0,
          planType,
          planCreditsTotal: creditLimit > 0 ? creditLimit : DEFAULT_CREDIT_LIMIT,
        };
        globalLastFetchTime = Date.now();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        activeFetchPromise = null;
      }
    })();

    await activeFetchPromise;
    setData(globalCreditData);
    setIsLoading(false);
  }, [authFetch]);

  useEffect(() => {
    fetchCredits();

    const handleRefetch = () => fetchCredits(true);
    window.addEventListener("credits:refetch", handleRefetch);

    return () => {
      window.removeEventListener("credits:refetch", handleRefetch);
    };
  }, [fetchCredits]);

  return {
    credits: data?.creditBalance ?? 0,
    planType: data?.planType ?? "free",
    totalCredits: data?.planCreditsTotal ?? 1500,
    isLoading,
    error,
    refetch: () => fetchCredits(true),
  };
}
