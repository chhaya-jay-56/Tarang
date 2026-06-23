"use client";

import { useCallback } from "react";
import { useApiClient } from "@/lib/api";
import { useVoiceSeparationStore } from "@/stores/voiceSeparationStore";

/**
 * Custom hook encapsulating voice separation logic:
 * file selection → upload to backend → Demucs separation → download stems.
 *
 * WHY synchronous endpoint (not SSE/polling):
 *   The /separate-direct endpoint is synchronous — it waits for Modal Demucs
 *   to finish (~30-60s for typical songs). This is simpler than the clone flow
 *   because separation has no multi-stage pipeline to report on.
 */
export function useVoiceSeparation() {
  const { authFetch } = useApiClient();
  const store = useVoiceSeparationStore();

  const selectFile = useCallback(
    (file: File) => {
      store.setFile(file);
    },
    [store]
  );

  const clearAll = useCallback(() => {
    store.clear();
  }, [store]);

  /** Upload file + trigger separation in one call. */
  const separate = useCallback(async () => {
    if (!store.file) return;

    store.setIsProcessing(true);
    store.setError(null);
    store.setStatusMessage("Uploading audio...");

    try {
      const formData = new FormData();
      formData.append("file", store.file);

      store.setStatusMessage("Separating vocals from instrumentals... This may take 30-60 seconds.");

      const res = await authFetch("/api/v1/separation/separate-direct", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        let msg = "Separation failed";
        if (typeof data.detail === "string") msg = data.detail;
        else if (data.detail) msg = JSON.stringify(data.detail);
        throw new Error(msg);
      }

      store.setResults({
        vocalsUrl: data.vocals_url,
        instrumentalUrl: data.instrumental_url,
        vocalsSizeBytes: data.vocals_size_bytes || null,
        instrumentalSizeBytes: data.instrumental_size_bytes || null,
        jobId: data.job_id,
      });

      // Update credits globally after successful separation
      window.dispatchEvent(new Event("credits:refetch"));
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Unknown error during separation";
      store.setError(msg);
      store.setIsProcessing(false);
      store.setStatusMessage("");
    }
  }, [store, authFetch]);

  /** Download a stem via presigned URL. */
  const downloadStem = useCallback(
    async (stemUrl: string, filename: string) => {
      try {
        store.setError(null);
        const res = await fetch(stemUrl);
        if (!res.ok) throw new Error("Download failed");

        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Download failed";
        store.setError(`Failed to download ${filename}: ${message}`);
      }
    },
    [store]
  );

  const downloadVocals = useCallback(() => {
    if (store.vocalsUrl) downloadStem(store.vocalsUrl, "vocals.wav");
  }, [store.vocalsUrl, downloadStem]);

  const downloadInstrumental = useCallback(() => {
    if (store.instrumentalUrl)
      downloadStem(store.instrumentalUrl, "instrumental.wav");
  }, [store.instrumentalUrl, downloadStem]);

  return {
    ...store,
    selectFile,
    clearAll,
    separate,
    downloadVocals,
    downloadInstrumental,
  };
}
