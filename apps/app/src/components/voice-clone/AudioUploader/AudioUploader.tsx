"use client";

import { useRef, useCallback, useState } from "react";
import { LuCloudUpload, LuMic } from "react-icons/lu";
import { AudioRecorder } from "../AudioRecorder/AudioRecorder";
import styles from "./AudioUploader.module.css";

type AudioUploaderProps = {
  onFileSelect: (file: File) => void;
};

/**
 * Drag-and-drop audio upload zone with an option to record audio.
 * Accepts ALL audio formats — the backend converts to WAV before processing.
 */
export function AudioUploader({ onFileSelect }: AudioUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "record">("upload");

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onFileSelect(e.target.files[0]);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile.type.includes("audio")) {
          onFileSelect(droppedFile);
        }
      }
    },
    [onFileSelect]
  );

  const handleRecordComplete = useCallback(
    (file: File) => {
      onFileSelect(file);
      setMode("upload");
    },
    [onFileSelect]
  );

  if (mode === "record") {
    return (
      <AudioRecorder
        onRecordComplete={handleRecordComplete}
        onCancel={() => setMode("upload")}
      />
    );
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={styles.dropZone}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={styles.iconWrapper}>
          <LuCloudUpload className={styles.icon} />
        </div>
        <div>
          <p className={styles.title}>Add or drop your audio files here</p>
          <p className={styles.subtitle}>WAV, MP3, OGG, FLAC, M4A, AAC, WEBM, WMA</p>
        </div>
        <input
          type="file"
          accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac,.webm,.wma"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </div>

      <div className={styles.dividerRow}>
        <span className={styles.dividerLine} />
        <span className={styles.dividerText}>or</span>
        <span className={styles.dividerLine} />
      </div>

      <button suppressHydrationWarning
        type="button"
        className={styles.recordToggle}
        onClick={() => setMode("record")}
      >
        <LuMic className={styles.recordToggleIcon} />
        Record Audio
        <span className={styles.recordBadge}>Max 2 min</span>
      </button>
    </div>
  );
}
