"use client";

import { useCallback } from "react";
import {
  LuCircleCheck,
  LuCirclePlay,
  LuCircleX,
  LuUpload,
  LuDownload,
} from "react-icons/lu";
import { FaPlay, FaPause } from "react-icons/fa6";
import { useGlobalAudio } from "@/hooks/useGlobalAudio";
import styles from "./HistoryCard.module.css";

/* ── Types ── */

interface HistoryMeta {
  filename?: string;
  text?: string;
  engine?: string;
  size_bytes?: number;
  duration_ms?: number;
  duration_seconds?: number;
  cloned_size_bytes?: number;
  cloned_duration_ms?: number;
  cloned_duration_seconds?: number;
  original_filename?: string;
  target_language?: string;
  error?: string;
}

export interface HistoryEntry {
  id: string;
  clone_job_id: string | null;
  action: string;
  metadata: HistoryMeta | null;
  created_at: string | null;
  download_url?: string;
}

/* ── Action config ── */

type ActionKey = "clone_completed" | "clone_started" | "clone_failed" | "uploaded";

interface ActionStyle {
  title: string;
  icon: React.ReactNode;
  iconClass: string;
}

const ACTION_STYLES: Record<ActionKey, ActionStyle> = {
  clone_completed: {
    title: "Voice Clone",
    icon: <LuCircleCheck className={styles.statusIcon} />,
    iconClass: styles.iconCompleted,
  },
  clone_started: {
    title: "Voice Clone",
    icon: <LuCirclePlay className={styles.statusIcon} />,
    iconClass: styles.iconPending,
  },
  clone_failed: {
    title: "Voice Clone",
    icon: <LuCircleX className={styles.statusIcon} />,
    iconClass: styles.iconFailed,
  },
  uploaded: {
    title: "Voice Uploaded",
    icon: <LuUpload className={styles.statusIcon} />,
    iconClass: styles.iconUploaded,
  },
};

/* ── Helpers ── */

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | undefined | null): string {
  if (ms == null || ms <= 0) return "--:--";
  const totalSec = ms / 1000;
  const min = Math.floor(totalSec / 60);
  const sec = Math.floor(totalSec % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

/* ── Component ── */

interface HistoryCardProps {
  entry: HistoryEntry;
  onDownload: (url: string, filename?: string) => void;
}

export function HistoryCard({ entry, onDownload }: HistoryCardProps) {
  const actionKey = entry.action as ActionKey;
  const config = ACTION_STYLES[actionKey] ?? ACTION_STYLES.uploaded;
  const meta = entry.metadata;

  const isCompleted = entry.action === "clone_completed";
  const isPending = entry.action === "clone_started";
  const isFailed = entry.action === "clone_failed";

  const { play, isPlayingUrl } = useGlobalAudio();
  const isPlaying = entry.download_url ? isPlayingUrl(entry.download_url) : false;

  const handlePlay = useCallback(() => {
    if (entry.download_url) {
      play(entry.download_url);
    }
  }, [entry.download_url, play]);

  // Duration display
  const durationMs =
    meta?.cloned_duration_ms ?? meta?.duration_ms ?? (meta?.duration_seconds ? meta.duration_seconds * 1000 : null);

  return (
    <div className={styles.card}>
      <div className={styles.leftSection}>
        {/* Status icon */}
        <div className={`${styles.iconWrapper} ${config.iconClass}`}>
          {config.icon}
        </div>

        {/* Info */}
        <div className={styles.infoBlock}>
          <span className={styles.title}>{config.title}</span>
          <span className={styles.dateRow}>{formatDate(entry.created_at)}</span>

          <div className={styles.metaRow}>
            {/* Duration */}
            <span>
              <span className={styles.metaLabel}>Duration: </span>
              <span className={isPending ? styles.metaPending : styles.metaValue}>
                {isPending ? "--:--" : formatDuration(durationMs)}
              </span>
            </span>
          </div>

          {/* Error message for failed clones */}
          {isFailed && meta?.error && (
            <span className={styles.errorText}>{meta.error}</span>
          )}
        </div>
      </div>

      {/* Actions: Play + Download — only for completed clones */}
      <div className={styles.rightSection}>
        {isCompleted && entry.download_url && (
          <>
            <button
              type="button"
              onClick={handlePlay}
              className={styles.playBtn}
              title={isPlaying ? "Pause" : "Preview output"}
            >
              {isPlaying ? <FaPause /> : <FaPlay className={styles.playOffset} />}
            </button>
            <button
              type="button"
              onClick={() =>
                onDownload(
                  entry.download_url!,
                  `${meta?.original_filename || "voice"}_cloned.wav`
                )
              }
              className={styles.downloadBtn}
            >
              <LuDownload className={styles.downloadIcon} />
              Download
            </button>
          </>
        )}
      </div>
    </div>
  );
}
