"use client";

import { useRef, useEffect, useCallback, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // ── Initialize WaveSurfer ──
  useEffect(() => {
    if (!containerRef.current) return;

    const url =
      typeof source === "string" ? source : URL.createObjectURL(source);

    const rootStyles = getComputedStyle(document.documentElement);
    const progressHex =
      rootStyles.getPropertyValue("--foreground").trim() || "#fafafa";
    const waveHex =
      rootStyles.getPropertyValue("--border").trim() || "#27272a";

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: waveHex,
      progressColor: progressHex,
      barWidth: 3,
      barGap: 3,
      barRadius: 4,
      height: 72,
      url,
      cursorWidth: 0,
      normalize: true,
      barHeight: 1.2,
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("timeupdate", (t) => setCurrentTime(t));
    ws.on("ready", (d) => setDuration(d));

    wsRef.current = ws;

    return () => {
      ws.destroy();
      if (typeof source !== "string") URL.revokeObjectURL(url);
    };
  }, [source]);

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

        {/* Time */}
        <div className={styles.timeDisplay}>
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

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
