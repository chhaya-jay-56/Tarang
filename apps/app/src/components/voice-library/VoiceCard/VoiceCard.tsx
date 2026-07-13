"use client";

import { useCallback } from "react";
import { FaPlay, FaPause } from "react-icons/fa6";
import { LuTrash2 } from "react-icons/lu";
import { HiOutlineStar } from "react-icons/hi2";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";
import styles from "./VoiceCard.module.css";

type VoiceCardProps = {
  id: string;
  name: string;
  description?: string | null;
  language: string;
  isPreset: boolean;
  audioUrl?: string | null;
  onDelete?: (id: string) => void;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
};

export function VoiceCard({
  id,
  name,
  description,
  language,
  isPreset,
  audioUrl,
  onDelete,
  onSelect,
  isSelected = false,
}: VoiceCardProps) {
  const { play, isPlayingUrl } = useGlobalAudio();
  const isPlaying = audioUrl ? isPlayingUrl(audioUrl) : false;

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioUrl) return;
    play(audioUrl);
  }, [audioUrl, play]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(id);
  }, [onDelete, id]);

  const handleClick = useCallback(() => {
    if (onSelect) onSelect(id);
  }, [onSelect, id]);

  // Language display name
  const langNames: Record<string, string> = {
    en: "English", hi: "Hindi", zh: "Chinese", ja: "Japanese",
    ko: "Korean", de: "German", fr: "French", ru: "Russian",
    pt: "Portuguese", es: "Spanish", it: "Italian",
  };
  const langDisplay = langNames[language] || language.toUpperCase();

  // Avatar initial
  const initial = name.charAt(0).toUpperCase();

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.cardSelected : ""}`}
      onClick={handleClick}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <div className={styles.cardInner}>
        {/* Avatar */}
        <div className={styles.avatar}>
          <span className={styles.avatarLetter}>{initial}</span>
        </div>

        {/* Info */}
        <div className={styles.info}>
          <div className={styles.nameRow}>
            <span className={styles.name}>{name}</span>
            {isPreset && (
              <span className={styles.presetBadge}>
                <HiOutlineStar className={styles.presetIcon} />
                Preset
              </span>
            )}
          </div>
          {description && (
            <p className={styles.description}>{description}</p>
          )}
          <span className={styles.langBadge}>{langDisplay}</span>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {audioUrl && (
            <button
              className={styles.playBtn}
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Preview"}
            >
              {isPlaying ? <FaPause /> : <FaPlay className={styles.playOffset} />}
            </button>
          )}
          {!isPreset && onDelete && (
            <button
              className={styles.deleteBtn}
              onClick={handleDelete}
              title="Delete voice"
            >
              <LuTrash2 />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
