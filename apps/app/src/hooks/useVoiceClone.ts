"use client";

import { useCallback, useEffect, useRef } from "react";
import { useApiClient } from "@/lib/api";
import { useVoiceCloneStore as defaultStore } from "@/stores/voiceCloneStore";

/**
 * Custom hook encapsulating all voice clone business logic:
 * upload, trigger clone, poll progress, download.
 *
 * Progress strategy: Polling the /status endpoint every 3s.
 * SSE was removed — it caused asyncpg connection errors due to
 * long-lived DB sessions being cancelled on stream close.
 */
export function useVoiceClone(useStoreHook = defaultStore) {
  const { authFetch } = useApiClient();
  const store = useStoreHook();

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFailsRef = useRef(0);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  // ── Helpers ──
  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "Unknown error";
  };

  const cleanupPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ── File selection ──
  const selectFile = useCallback(
    (file: File) => {
      store.setFile(file);
      store.setVoiceId(null);
      store.setJobId(null);
      store.setClonedAudioUrl(null);
      store.setCloneError(null);
      store.setCloneProgress("", "");
    },
    [store]
  );

  const clearAll = useCallback(() => {
    cleanupPolling();
    store.clear();
  }, [store, cleanupPolling]);

  // ── Upload ──
  const upload = useCallback(async () => {
    if (!store.file) return;
    store.setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", store.file);

      const res = await authFetch("/api/voices/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        let msg = "Failed to upload to backend";
        if (typeof data.detail === "string") msg = data.detail;
        else if (data.detail) msg = JSON.stringify(data.detail);
        throw new Error(msg);
      }
      store.setVoiceId(data.asset_id || data.voice_id);
      store.setCloneError(null);
    } catch (err: unknown) {
      store.setCloneError(`Upload failed: ${getErrorMessage(err)}`);
    } finally {
      store.setIsUploading(false);
    }
  }, [store, authFetch]);

  // ── Handle incoming status data ──
  const handleStatusUpdate = useCallback(
    (data: {
      status: string;
      clone_stage?: string;
      stage_message?: string;
      output_url?: string;
      error_message?: string;
    }): boolean => {
      // Returns true if terminal (should stop polling)
      if (data.status === "succeeded") {
        store.setCloneProgress("completed", "Clone complete!");
        store.setClonedAudioUrl(data.output_url || null);
        store.setIsCloning(false);
        return true;
      }

      if (data.status === "failed") {
        store.setCloneError(data.error_message || "Clone failed");
        store.setCloneProgress("failed", data.stage_message || "Clone failed.");
        store.setIsCloning(false);
        return true;
      }

      // In-progress update
      store.setCloneProgress(
        data.clone_stage || "processing",
        data.stage_message || "Processing..."
      );
      return false;
    },
    [store]
  );

  // ── Polling ──
  const startPolling = useCallback(
    (jobId: string) => {
      consecutiveFailsRef.current = 0;
      const startTime = Date.now();
      const POLL_MS = 3000;
      const TIMEOUT_MS = 5 * 60 * 1000;

      const poll = async () => {
        if (Date.now() - startTime > TIMEOUT_MS) {
          store.setCloneError("Clone is taking too long. Please try again.");
          store.setIsCloning(false);
          return;
        }

        try {
          const statusRes = await authFetch(`/api/voices/${jobId}/status`);
          const statusData = await statusRes.json();
          consecutiveFailsRef.current = 0;

          const isTerminal = handleStatusUpdate(statusData);
          if (isTerminal) return;
        } catch {
          consecutiveFailsRef.current += 1;
          if (consecutiveFailsRef.current >= 5) {
            store.setCloneError(
              "Connection lost. Please check your network and try again."
            );
            store.setIsCloning(false);
            return;
          }
        }

        pollTimerRef.current = setTimeout(poll, POLL_MS);
      };

      // First poll is immediate
      poll();
    },
    [store, authFetch, handleStatusUpdate]
  );

  // ── Clone ──
  const clone = useCallback(async () => {
    if (!store.voiceId || !store.text) return;
    store.setIsCloning(true);
    store.setClonedAudioUrl(null);
    store.setCloneError(null);
    store.setCloneProgress("queued", "Starting clone...");

    const currentVoiceId = store.voiceId;

    try {
      const res = await authFetch(`/api/voices/${currentVoiceId}/clone`, {
        method: "POST",
        body: JSON.stringify({
          text: store.text,
          target_language: store.targetLanguage,
          speed: store.speed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Clone failed");

      const jobId = data.job_id || data.voice_id || currentVoiceId;
      store.setJobId(jobId);

      // Start polling for progress
      startPolling(jobId);
      
      // Dispatch event to update credits instantly
      window.dispatchEvent(new Event("credits:refetch"));
    } catch (err: unknown) {
      store.setCloneError(getErrorMessage(err));
      store.setIsCloning(false);
    }
  }, [store, authFetch, startPolling]);

  // ── Download ──
  const download = useCallback(async () => {
    const downloadId = store.jobId || store.voiceId;
    if (!downloadId) return;
    try {
      const res = await authFetch(`/api/voices/${downloadId}/download`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Download failed");

      const audioRes = await fetch(data.download_url);
      const blob = await audioRes.blob();

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = data.filename || "cloned_voice.wav";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      store.setCloneError(null);
    } catch (err: unknown) {
      store.setCloneError(`Download failed: ${getErrorMessage(err)}`);
    }
  }, [store, authFetch]);

  // ── Retry ──
  const retry = useCallback(() => {
    cleanupPolling();
    store.setCloneError(null);
    store.setCloneProgress("", "");
    clone();
  }, [store, cleanupPolling, clone]);

  return {
    // State (re-exported from store for convenience)
    ...store,
    consecutiveFails: consecutiveFailsRef.current,

    // Actions
    selectFile,
    clearAll,
    upload,
    clone,
    download,
    retry,
  };
}
