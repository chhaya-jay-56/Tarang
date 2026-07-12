"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { LuChevronDown, LuCheck, LuLibrary } from "react-icons/lu";
import { Hatch } from "ldrs/react";
import "ldrs/react/Hatch.css";
import { useApiClient } from "@/lib/api";
import type { SavedVoice } from "@/stores/voiceLibraryStore";
import styles from "./VoicePicker.module.css";

type VoicePickerProps = {
  onSelect: (voice: SavedVoice) => void;
  selectedId?: string | null;
};

/**
 * Dropdown to pick a voice from the user's voice library.
 * Shows saved custom voices + platform presets.
 */
export function VoicePicker({ onSelect, selectedId }: VoicePickerProps) {
  const { authFetch } = useApiClient();
  const [isOpen, setIsOpen] = useState(false);
  const [voices, setVoices] = useState<SavedVoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch voices when opened
  const handleOpen = useCallback(async () => {
    setIsOpen((prev) => !prev);
    if (voices.length === 0) {
      setIsLoading(true);
      try {
        const res = await authFetch("/api/voice-library");
        const data = await res.json();
        if (res.ok && data.voices) {
          setVoices(data.voices);
        }
      } catch {
        // Silent fail — user will see empty list
      } finally {
        setIsLoading(false);
      }
    }
  }, [authFetch, voices.length]);

  const handleSelect = useCallback(
    (voice: SavedVoice) => {
      onSelect(voice);
      setIsOpen(false);
    },
    [onSelect]
  );

  const selectedVoice = voices.find((v) => v.id === selectedId);

  const customVoices = voices.filter((v) => !v.is_preset);
  const presetVoices = voices.filter((v) => v.is_preset);

  return (
    <div className={styles.wrapper} ref={containerRef}>
      <button suppressHydrationWarning
        type="button"
        className={styles.trigger}
        onClick={handleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <LuLibrary className={styles.triggerIcon} />
        <span className={selectedVoice ? styles.triggerText : styles.triggerPlaceholder}>
          {selectedVoice ? selectedVoice.name : "Use from Voice Library"}
        </span>
        <LuChevronDown className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="listbox">
          {isLoading ? (
            <div className={styles.loading}>
              <Hatch size="18" stroke="3" speed="3.5" color="currentColor" />
              <span>Loading voices...</span>
            </div>
          ) : voices.length === 0 ? (
            <div className={styles.empty}>
              No voices found. Create one in Voice Library.
            </div>
          ) : (
            <>
              {/* Custom voices */}
              {customVoices.length > 0 && (
                <>
                  <div className={styles.groupLabel}>Your Voices</div>
                  {customVoices.map((voice) => (
                    <button suppressHydrationWarning
                      key={voice.id}
                      type="button"
                      className={`${styles.option} ${selectedId === voice.id ? styles.optionSelected : ""}`}
                      onClick={() => handleSelect(voice)}
                      role="option"
                      aria-selected={selectedId === voice.id}
                    >
                      <span className={styles.optionName}>{voice.name}</span>
                      <span className={styles.optionMeta}>
                        {selectedId === voice.id ? <LuCheck /> : voice.language.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* Preset voices */}
              {presetVoices.length > 0 && (
                <>
                  <div className={styles.groupLabel}>Pre-built</div>
                  {presetVoices.map((voice) => (
                    <button suppressHydrationWarning
                      key={voice.id}
                      type="button"
                      className={`${styles.option} ${selectedId === voice.id ? styles.optionSelected : ""}`}
                      onClick={() => handleSelect(voice)}
                      role="option"
                      aria-selected={selectedId === voice.id}
                    >
                      <span className={styles.optionName}>{voice.name}</span>
                      <span className={styles.optionMeta}>
                        {selectedId === voice.id ? <LuCheck /> : voice.language.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
