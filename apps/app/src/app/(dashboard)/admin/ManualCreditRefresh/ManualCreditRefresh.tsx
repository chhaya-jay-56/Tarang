"use client";

import { useState, useEffect, useCallback } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import styles from "./ManualCreditRefresh.module.css";

interface RefreshStatus {
  last_refresh_at: string | null;
  last_refresh_by: string | null;
  last_refresh_count: number | null;
}

interface ManualCreditRefreshProps {
  admin: ReturnType<typeof useAdmin>;
  onRefreshCompleted?: () => void;
}

export default function ManualCreditRefresh({
  admin,
  onRefreshCompleted,
}: ManualCreditRefreshProps) {
  const [status, setStatus] = useState<RefreshStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await admin.getCreditRefreshStatus();
      setStatus(data);
    } catch (err) {
      console.error("Failed to load credit refresh status:", err);
    }
  }, [admin]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleRefresh = useCallback(async () => {
    const confirmed = window.confirm(
      "Are you sure you want to refresh all users' credit balances back to 5,000 (their limit)?\n\nThis will immediately restore full credits for any user who has spent credits."
    );
    if (!confirmed) return;

    setLoading(true);
    setFeedback(null);

    try {
      const result = await admin.refreshAllCredits();
      setFeedback({
        type: "success",
        text: `Successfully refreshed credits for ${result.users_refreshed} user${result.users_refreshed === 1 ? "" : "s"}.`,
      });
      fetchStatus();
      onRefreshCompleted?.();
    } catch (err) {
      console.error("Failed to refresh credits:", err);
      setFeedback({
        type: "error",
        text: "Failed to execute credit refresh. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }, [admin, fetchStatus, onRefreshCompleted]);

  const formatTimestamp = (isoString: string | null) => {
    if (!isoString) return "Never";
    try {
      return new Date(isoString).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Manual Credit Refresh</span>
          <span className={styles.badge}>On-Demand</span>
        </div>
      </div>

      <div className={styles.body}>
        <p className={styles.description}>
          Restores all active users' credit balances to their full allocation (5,000 credits).
          Zero automated jobs will run; credit resets only occur when you click this button.
        </p>

        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Last Refresh</span>
            <span className={styles.statValue}>
              {formatTimestamp(status?.last_refresh_at ?? null)}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Users Refreshed</span>
            <span className={styles.statValue}>
              {status?.last_refresh_count != null ? `${status.last_refresh_count} users` : "—"}
            </span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Initiated By</span>
            <span className={styles.statValue}>
              {status?.last_refresh_by || "—"}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={loading}
            id="btn-manual-credit-refresh"
          >
            {loading ? "Refreshing..." : "Refresh All Users' Credits (5,000)"}
          </button>

          {feedback && (
            <span
              className={feedback.type === "success" ? styles.msgSuccess : styles.msgError}
            >
              {feedback.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
