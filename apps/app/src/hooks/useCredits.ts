"use client";

import { useApiClient } from "@/lib/api";
import { useState, useEffect, useRef, useCallback } from "react";

interface CreditData {
  creditBalance: number;
  planType: string;
  planCreditsTotal: number;
}

const PLAN_TOTALS: Record<string, number> = {
  free: 1500,
  starter: 10_000,
  premium: 30_000,
};

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

        globalCreditData = {
          creditBalance: json.credit_balance ?? 0,
          planType,
          planCreditsTotal: PLAN_TOTALS[planType] ?? PLAN_TOTALS.free,
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
