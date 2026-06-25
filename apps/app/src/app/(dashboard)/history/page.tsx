"use client";

import { useEffect, useState, useCallback } from "react";
import { useApiClient } from "@/lib/api";
import { HistoryList } from "@/components/history/HistoryList/HistoryList";
import type { HistoryEntry } from "@/components/history/HistoryCard/HistoryCard";

/**
 * History page — data fetching + layout only.
 * All card rendering is delegated to HistoryList → HistoryCard.
 */
export default function HistoryPage() {
  const { authFetch } = useApiClient();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to load history");
      setEntries(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDownload = useCallback(
    async (downloadUrl: string, filename?: string) => {
      try {
        setDownloadError(null);
        const audioRes = await fetch(downloadUrl);
        if (!audioRes.ok) throw new Error("Download URL failed");
        const blob = await audioRes.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename || "cloned_voice.wav";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        setDownloadError(
          err instanceof Error ? err.message : "Download failed"
        );
      }
    },
    []
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px", maxWidth: "800px", width: "100%", padding: "0 16px", margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 600, color: "var(--foreground)", letterSpacing: "0.02em", textAlign: "left" }}>
          Voice Cloning History
        </h1>
        <p style={{ color: "var(--muted-foreground)", fontSize: "14px", textAlign: "left" }}>
          All your past voice generations appear here.
        </p>
      </div>

      {downloadError && (
        <div style={{ color: "var(--destructive)", fontSize: "14px" }}>
          {downloadError}
        </div>
      )}

      <HistoryList
        entries={entries}
        isLoading={isLoading}
        error={error}
        onDownload={handleDownload}
      />
    </div>
  );
}
