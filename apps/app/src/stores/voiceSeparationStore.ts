"use client";

import { create } from "zustand";

type SeparationState = {
  file: File | null;
  isProcessing: boolean;
  error: string | null;
  statusMessage: string;
  vocalsUrl: string | null;
  instrumentalUrl: string | null;
  vocalsSizeBytes: number | null;
  instrumentalSizeBytes: number | null;
  jobId: string | null;

  setFile: (file: File | null) => void;
  setIsProcessing: (v: boolean) => void;
  setError: (msg: string | null) => void;
  setStatusMessage: (msg: string) => void;
  setResults: (data: {
    vocalsUrl: string;
    instrumentalUrl: string;
    vocalsSizeBytes: number | null;
    instrumentalSizeBytes: number | null;
    jobId: string;
  }) => void;
  clear: () => void;
};

export const useVoiceSeparationStore = create<SeparationState>((set) => ({
  file: null,
  isProcessing: false,
  error: null,
  statusMessage: "",
  vocalsUrl: null,
  instrumentalUrl: null,
  vocalsSizeBytes: null,
  instrumentalSizeBytes: null,
  jobId: null,

  setFile: (file) =>
    set({
      file,
      vocalsUrl: null,
      instrumentalUrl: null,
      vocalsSizeBytes: null,
      instrumentalSizeBytes: null,
      error: null,
      statusMessage: "",
      jobId: null,
    }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setError: (error) => set({ error }),
  setStatusMessage: (statusMessage) => set({ statusMessage }),
  setResults: (data) =>
    set({
      vocalsUrl: data.vocalsUrl,
      instrumentalUrl: data.instrumentalUrl,
      vocalsSizeBytes: data.vocalsSizeBytes,
      instrumentalSizeBytes: data.instrumentalSizeBytes,
      jobId: data.jobId,
      isProcessing: false,
      error: null,
      statusMessage: "Separation complete!",
    }),
  clear: () =>
    set({
      file: null,
      isProcessing: false,
      error: null,
      statusMessage: "",
      vocalsUrl: null,
      instrumentalUrl: null,
      vocalsSizeBytes: null,
      instrumentalSizeBytes: null,
      jobId: null,
    }),
}));
