import { create } from "zustand";

type VoiceCloneStore = {
  // State
  voiceId: string | null;
  jobId: string | null;
  text: string;
  targetLanguage: string;
  clonedAudioUrl: string | null;
  file: File | null;
  fileName: string | null;
  isUploading: boolean;
  isCloning: boolean;
  cloneStage: string | null;
  stageMessage: string | null;
  cloneError: string | null;

  // Actions
  setVoiceId: (id: string | null) => void;
  setJobId: (id: string | null) => void;
  setText: (t: string) => void;
  setTargetLanguage: (lang: string) => void;
  setClonedAudioUrl: (url: string | null) => void;
  setFile: (f: File | null) => void;
  setIsUploading: (v: boolean) => void;
  setIsCloning: (v: boolean) => void;
  setCloneProgress: (stage: string, message: string) => void;
  setCloneError: (err: string | null) => void;
  clear: () => void;
};

const initialState = {
  voiceId: null,
  jobId: null,
  text: "",
  targetLanguage: "en",
  clonedAudioUrl: null,
  file: null,
  fileName: null,
  isUploading: false,
  isCloning: false,
  cloneStage: null,
  stageMessage: null,
  cloneError: null,
};

export const useVoiceCloneStore = create<VoiceCloneStore>((set) => ({
  ...initialState,

  setVoiceId: (id) => set({ voiceId: id }),
  setJobId: (id) => set({ jobId: id }),
  setText: (t) => set({ text: t }),
  setTargetLanguage: (lang) => set({ targetLanguage: lang }),
  setClonedAudioUrl: (url) => set({ clonedAudioUrl: url }),
  setFile: (f) => set({ file: f, fileName: f?.name ?? null }),
  setIsUploading: (v) => set({ isUploading: v }),
  setIsCloning: (v) => set({ isCloning: v }),
  setCloneProgress: (stage, message) =>
    set({ cloneStage: stage, stageMessage: message }),
  setCloneError: (err) => set({ cloneError: err }),
  clear: () => set(initialState),
}));
