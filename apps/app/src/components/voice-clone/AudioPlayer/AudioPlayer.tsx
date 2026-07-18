"use client";

import { useRef, useEffect, useCallback, useState, useId } from "react";
import { LuMusic } from "react-icons/lu";
import { FaPlay, FaPause, FaBackward, FaForward } from "react-icons/fa6";
import WaveSurfer from "wavesurfer.js";
import styles from "./AudioPlayer.module.css";

type AudioPlayerProps = {
  /** Audio source — File object or URL string */
  source: File | string;
  /** Badge label shown in the top-left */
  label: string;
  /** Optional action button in the header (e.g. close, download) */
  headerAction?: React.ReactNode;
};

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ source, label, headerAction }: AudioPlayerProps) {
  const playerId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── Initialize WaveSurfer ──
  useEffect(() => {
    if (!containerRef.current) return;

    setIsLoading(true);
    setLoadError(null);

    const rootStyles = getComputedStyle(document.documentElement);
    const progressHex =
      rootStyles.getPropertyValue("--foreground").trim() || "#fafafa";
    const waveHex =
      rootStyles.getPropertyValue("--border").trim() || "#27272a";

    // Create WaveSurfer WITHOUT a url — we'll load the source manually after
    // creation to use the more reliable loadBlob() path for File objects.
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: waveHex,
      progressColor: progressHex,
      barWidth: 3,
      barGap: 3,
      barRadius: 4,
      height: 72,
      cursorWidth: 0,
      normalize: true,
      barHeight: 1.2,
    });

    ws.on("play", () => {
      setIsPlaying(true);
      window.dispatchEvent(new CustomEvent("tarang:audioPlay", { detail: { id: playerId } }));
    });
    ws.on("pause", () => setIsPlaying(false));
    ws.on("timeupdate", (t) => setCurrentTime(t));
    // Use decoded AudioBuffer duration (PCM-based, always accurate)
    // instead of container metadata which is often wrong for WebM blobs from MediaRecorder
    ws.on("ready", () => {
      const decoded = ws.getDecodedData();
      setDuration(decoded ? decoded.duration : ws.getDuration());
      setIsLoading(false);
    });
    ws.on("error", (err) => {
      console.error("[AudioPlayer] WaveSurfer error:", err);
      setLoadError("Failed to load audio. The file may be corrupted or unsupported.");
      setIsLoading(false);
    });

    wsRef.current = ws;

    // Load audio — use loadBlob() for File/Blob objects (bypasses fetch,
    // reads ArrayBuffer directly — much more reliable on mobile).
    // Use load() only for URL strings.
    if (typeof source === "string") {
      ws.load(source).catch(() => {
        setLoadError("Failed to load audio from URL.");
        setIsLoading(false);
      });
    } else {
      ws.loadBlob(source).catch(() => {
        setLoadError("Failed to decode audio file.");
        setIsLoading(false);
      });
    }

    return () => {
      ws.destroy();
    };
  }, [source, playerId]);

  // ── Listen for other players playing ──
  useEffect(() => {
    const handleGlobalPlay = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.id !== playerId && wsRef.current?.isPlaying()) {
        wsRef.current.pause();
      }
    };
    
    window.addEventListener("tarang:audioPlay", handleGlobalPlay);
    return () => window.removeEventListener("tarang:audioPlay", handleGlobalPlay);
  }, [playerId]);

  const togglePlay = useCallback(() => wsRef.current?.playPause(), []);
  const jumpBack = useCallback(() => wsRef.current?.skip(-5), []);
  const jumpForward = useCallback(() => wsRef.current?.skip(5), []);

  return (
    <div className={styles.playerCard}>
      <div className={styles.playerInner}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.badge}>
            <LuMusic className={styles.badgeIcon} />
            <span>{label}</span>
          </div>
          {headerAction}
        </div>

        {/* Waveform */}
        <div ref={containerRef} className={styles.waveform} />

        {/* Loading / Error state */}
        {isLoading && (
          <div className={styles.timeDisplay}>
            <span>Loading…</span>
          </div>
        )}
        {loadError && (
          <div className={styles.timeDisplay}>
            <span style={{ color: "var(--destructive, #ef4444)", fontSize: "0.8rem" }}>
              {loadError}
            </span>
          </div>
        )}

        {/* Time */}
        {!isLoading && !loadError && (
          <div className={styles.timeDisplay}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        )}

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <button onClick={jumpBack} className={styles.controlBtn}>
              <FaBackward />
            </button>
            <button onClick={togglePlay} className={styles.playBtn}>
              {isPlaying ? (
                <FaPause />
              ) : (
                <FaPlay className={styles.playOffset} />
              )}
            </button>
            <button onClick={jumpForward} className={styles.controlBtn}>
              <FaForward />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

