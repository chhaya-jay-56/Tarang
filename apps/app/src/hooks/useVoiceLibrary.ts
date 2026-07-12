"use client";

import { useCallback, useEffect } from "react";
import { useApiClient } from "@/lib/api";
import { useVoiceLibraryStore } from "@/stores/voiceLibraryStore";

/**
 * Hook for Voice Library operations:
 * - Fetch all voices (user + presets)
 * - Create a new voice (upload ref audio)
 * - Delete a custom voice
 */
export function useVoiceLibrary() {
  const { authFetch } = useApiClient();
  const store = useVoiceLibraryStore();

  // ── Fetch voices on mount ──
  const fetchVoices = useCallback(async () => {
    store.setIsLoading(true);
    store.setError(null);
    try {
      const res = await authFetch("/api/voice-library");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to load voices");
      store.setVoices(data.voices || []);
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Failed to load voices");
    } finally {
      store.setIsLoading(false);
    }
  }, [authFetch, store]);

  useEffect(() => {
    fetchVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Create voice ──
  const createVoice = useCallback(async () => {
    if (!store.createFile || !store.createName.trim()) return null;

    store.setIsCreating(true);
    store.setError(null);

    try {
      const formData = new FormData();
      formData.append("file", store.createFile);
      formData.append("name", store.createName.trim());
      if (store.createDescription.trim()) {
        formData.append("description", store.createDescription.trim());
      }
      formData.append("language", store.createLanguage);

      const res = await authFetch("/api/voice-library", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to create voice");

      // Add new voice to list and clear form
      store.setVoices([data, ...store.voices]);
      store.clearCreateForm();
      return data;
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Failed to create voice");
      return null;
    } finally {
      store.setIsCreating(false);
    }
  }, [authFetch, store]);

  // ── Delete voice ──
  const deleteVoice = useCallback(async (voiceId: string) => {
    try {
      const res = await authFetch(`/api/voice-library/${voiceId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json();
        throw new Error(data?.detail || "Failed to delete voice");
      }
      store.setVoices(store.voices.filter((v) => v.id !== voiceId));
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Failed to delete voice");
    }
  }, [authFetch, store]);

  // ── Derived data ──
  const customVoices = store.voices.filter((v) => !v.is_preset);
  const presetVoices = store.voices.filter((v) => v.is_preset);

  return {
    ...store,
    customVoices,
    presetVoices,
    fetchVoices,
    createVoice,
    deleteVoice,
  };
}
