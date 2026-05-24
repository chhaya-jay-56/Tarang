"use client";

import { useCallback, useEffect, useRef } from "react";
import { useApiClient } from "@/lib/api";
import { useVoiceCloneStore } from "@/stores/voiceCloneStore";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Custom hook encapsulating all voice clone business logic:
 * upload, trigger clone, real-time progress, download.
 *
 * Progress strategy: Tries SSE first for instant updates.
 * Falls back to polling automatically if SSE fails to connect
 * within 5 seconds (handles CORS, ngrok, proxy issues).
 */
export function useVoiceClone() {
  const { authFetch, getAuthToken } = useApiClient();
  const store = useVoiceCloneStore();

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFailsRef = useRef(0);
  const usingPollingRef = useRef(false);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (sseTimeoutRef.current) {
        clearTimeout(sseTimeoutRef.current);
        sseTimeoutRef.current = null;
      }
    };
  }, []);

  // ── Helpers ──
  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "Unknown error";
  };

  const cleanupConnections = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (sseTimeoutRef.current) {
      clearTimeout(sseTimeoutRef.current);
      sseTimeoutRef.current = null;
    }
    usingPollingRef.current = false;
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
    cleanupConnections();
    store.clear();
  }, [store, cleanupConnections]);

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
    } catch (err: unknown) {
      alert(`Upload failed: ${getErrorMessage(err)}`);
    } finally {
      store.setIsUploading(false);
    }
  }, [store, authFetch]);

  // ── Handle incoming status data (shared by SSE + polling) ──
  const handleStatusUpdate = useCallback(
    (data: {
      status: string;
      clone_stage?: string;
      stage_message?: string;
      output_url?: string;
      error_message?: string;
    }): boolean => {
      // Returns true if terminal (should stop listening)
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

  // ── Polling fallback ──
  const startPolling = useCallback(
    (jobId: string) => {
      usingPollingRef.current = true;
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

      // First poll is IMMEDIATE (no delay) — critical after SSE fallback
      poll();
    },
    [store, authFetch, handleStatusUpdate]
  );

  // ── SSE stream with auto-fallback to polling ──
  const startProgressTracking = useCallback(
    (jobId: string, token: string) => {
      // Close any existing connections
      cleanupConnections();

      let sseConnected = false;

      // Try SSE first
      try {
        const sseUrl = `${API_BASE}/api/sse/${jobId}/stream?token=${encodeURIComponent(token)}`;
        const es = new EventSource(sseUrl);
        eventSourceRef.current = es;

        es.onmessage = (event) => {
          sseConnected = true;

          // Cancel the fallback timeout since SSE is working
          if (sseTimeoutRef.current) {
            clearTimeout(sseTimeoutRef.current);
            sseTimeoutRef.current = null;
          }

          try {
            const data = JSON.parse(event.data);
            const isTerminal = handleStatusUpdate(data);
            if (isTerminal) {
              es.close();
              eventSourceRef.current = null;
            }
          } catch {
            // Ignore malformed JSON
          }
        };

        es.onerror = () => {
          // If SSE never connected, the timeout fallback will handle it.
          // If SSE was working and then failed, fall back to polling.
          if (sseConnected) {
            es.close();
            eventSourceRef.current = null;
            // SSE was working but lost connection — fall back to polling
            startPolling(jobId);
          }
          // If not yet connected, let the timeout handle fallback
        };

        // Fallback: if SSE doesn't deliver an event within 5s, switch to polling
        sseTimeoutRef.current = setTimeout(() => {
          if (!sseConnected) {
            // SSE failed to connect — close and fall back
            es.close();
            eventSourceRef.current = null;
            console.warn("[Tarang] SSE failed to connect, falling back to polling");
            startPolling(jobId);
          }
        }, 5000);
      } catch {
        // EventSource constructor failed — go straight to polling
        console.warn("[Tarang] EventSource unavailable, using polling");
        startPolling(jobId);
      }
    },
    [cleanupConnections, handleStatusUpdate, startPolling]
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Clone failed");

      const jobId = data.job_id || data.voice_id || currentVoiceId;
      store.setJobId(jobId);

      // Get auth token for SSE (EventSource can't set headers)
      const token = await getAuthToken();

      if (token) {
        // Try SSE with auto-fallback to polling
        startProgressTracking(jobId, token);
      } else {
        // No token available for SSE — go straight to polling
        startPolling(jobId);
      }
    } catch (err: unknown) {
      store.setCloneError(getErrorMessage(err));
      store.setIsCloning(false);
    }
  }, [store, authFetch, getAuthToken, startProgressTracking, startPolling]);

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
    } catch (err: unknown) {
      alert("Download failed: " + getErrorMessage(err));
    }
  }, [store.jobId, store.voiceId, authFetch]);

  // ── Retry ──
  const retry = useCallback(() => {
    cleanupConnections();
    store.setCloneError(null);
    store.setCloneProgress("", "");
    clone();
  }, [store, cleanupConnections, clone]);

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
