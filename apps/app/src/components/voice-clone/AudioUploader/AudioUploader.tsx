"use client";

import { useRef, useCallback } from "react";
import { LuCloudUpload } from "react-icons/lu";
import styles from "./AudioUploader.module.css";

type AudioUploaderProps = {
  onFileSelect: (file: File) => void;
};

export function AudioUploader({ onFileSelect }: AudioUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
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
        <p className={styles.subtitle}>Supports WAV only</p>
      </div>
      <input
        type="file"
        accept=".wav"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
    </div>
  );
}
