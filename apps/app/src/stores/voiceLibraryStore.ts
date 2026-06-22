import { create } from "zustand";

export type SavedVoice = {
  id: string;
  name: string;
  description?: string | null;
  voice_type: "custom" | "preset";
  language: string;
  duration_ms?: number | null;
  is_preset: boolean;
  audio_url?: string | null;
  r2_key: string;
  created_at?: string | null;
};

type VoiceLibraryStore = {
  // State
  voices: SavedVoice[];
  isLoading: boolean;
  error: string | null;

  // Create voice form
  createName: string;
  createDescription: string;
  createLanguage: string;
  createFile: File | null;
  isCreating: boolean;

  // Actions
  setVoices: (voices: SavedVoice[]) => void;
  setIsLoading: (v: boolean) => void;
  setError: (err: string | null) => void;
  setCreateName: (name: string) => void;
  setCreateDescription: (desc: string) => void;
  setCreateLanguage: (lang: string) => void;
  setCreateFile: (file: File | null) => void;
  setIsCreating: (v: boolean) => void;
  clearCreateForm: () => void;
};

const createFormDefaults = {
  createName: "",
  createDescription: "",
  createLanguage: "en",
  createFile: null,
  isCreating: false,
};

export const useVoiceLibraryStore = create<VoiceLibraryStore>((set) => ({
  voices: [],
  isLoading: false,
  error: null,
  ...createFormDefaults,

  setVoices: (voices) => set({ voices }),
  setIsLoading: (v) => set({ isLoading: v }),
  setError: (err) => set({ error: err }),
  setCreateName: (name) => set({ createName: name }),
  setCreateDescription: (desc) => set({ createDescription: desc }),
  setCreateLanguage: (lang) => set({ createLanguage: lang }),
  setCreateFile: (file) => set({ createFile: file }),
  setIsCreating: (v) => set({ isCreating: v }),
  clearCreateForm: () => set(createFormDefaults),
}));
