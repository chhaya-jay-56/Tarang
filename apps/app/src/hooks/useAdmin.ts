"use client";

import { useApiClient } from "@/lib/api";
import { useCallback } from "react";

/**
 * Hook for admin API operations.
 * All endpoints are admin-only — backend enforces via is_admin check.
 */
export function useAdmin() {
  const { authFetch } = useApiClient();

  const adminFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      return authFetch(`/api/admin${url}`, options);
    },
    [authFetch]
  );

  const listUsers = useCallback(
    async (page = 1, perPage = 50) => {
      const res = await adminFetch(`/users?page=${page}&per_page=${perPage}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    [adminFetch]
  );

  const searchUsers = useCallback(
    async (query: string) => {
      const res = await adminFetch(`/users/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Failed to search users");
      return res.json();
    },
    [adminFetch]
  );

  const updateCreditLimit = useCallback(
    async (userId: string, newLimit: number) => {
      const res = await adminFetch(`/users/${userId}/credit-limit`, {
        method: "PATCH",
        body: JSON.stringify({ new_limit: newLimit }),
      });
      if (!res.ok) throw new Error("Failed to update credit limit");
      return res.json();
    },
    [adminFetch]
  );

  const bulkReassign = useCallback(
    async (newLimit: number, maxUsers?: number) => {
      const res = await adminFetch("/bulk-reassign", {
        method: "POST",
        body: JSON.stringify({ new_limit: newLimit, max_users: maxUsers }),
      });
      if (!res.ok) throw new Error("Failed to bulk reassign");
      return res.json();
    },
    [adminFetch]
  );

  const getConfig = useCallback(async () => {
    const res = await adminFetch("/config");
    if (!res.ok) throw new Error("Failed to fetch config");
    return res.json();
  }, [adminFetch]);

  const updateConfig = useCallback(
    async (key: string, value: string) => {
      const res = await adminFetch(`/config/${key}`, {
        method: "PATCH",
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("Failed to update config");
      return res.json();
    },
    [adminFetch]
  );

  const getOverview = useCallback(async () => {
    const res = await adminFetch("/insights/overview");
    if (!res.ok) throw new Error("Failed to fetch overview");
    return res.json();
  }, [adminFetch]);

  const getTopSpenders = useCallback(async () => {
    const res = await adminFetch("/insights/top-spenders?limit=20");
    if (!res.ok) throw new Error("Failed to fetch top spenders");
    return res.json();
  }, [adminFetch]);

  const getServiceUsage = useCallback(async () => {
    const res = await adminFetch("/insights/service-usage");
    if (!res.ok) throw new Error("Failed to fetch service usage");
    return res.json();
  }, [adminFetch]);

  const getIdleUsers = useCallback(async () => {
    const res = await adminFetch("/insights/idle-users?threshold_pct=10&days_old=14");
    if (!res.ok) throw new Error("Failed to fetch idle users");
    return res.json();
  }, [adminFetch]);

  return {
    listUsers,
    searchUsers,
    updateCreditLimit,
    bulkReassign,
    getConfig,
    updateConfig,
    getOverview,
    getTopSpenders,
    getServiceUsage,
    getIdleUsers,
  };
}
