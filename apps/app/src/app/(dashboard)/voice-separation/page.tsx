"use client";

import { useRef, useCallback } from "react";
import {
  LuCloudUpload,
  LuX,
  LuDownload,
  LuCircleAlert,
  LuCircleCheck,
  LuTriangleAlert,
  LuRotateCcw,
  LuPlus,
} from "react-icons/lu";
import { Hatch } from "ldrs/react";
import "ldrs/react/Hatch.css";
import { HiOutlineMusicalNote } from "react-icons/hi2";
import { RiVoiceprintLine } from "react-icons/ri";
import { TbMusic } from "react-icons/tb";
import { Button } from "@/components/ui/button";
import { useVoiceSeparation } from "@/hooks/useVoiceSeparation";
import styles from "./page.module.css";

/** Format bytes into human-readable size string. */
function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function VoiceSeparationPage() {
  const {
    file,
    isProcessing,
    error,
    statusMessage,
    vocalsUrl,
    instrumentalUrl,
    vocalsSizeBytes,
    instrumentalSizeBytes,
    selectFile,
    clearAll,
    separate,
    downloadVocals,
    downloadInstrumental,
  } = useVoiceSeparation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        selectFile(e.target.files[0]);
      }
    },
    [selectFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile.type.includes("audio")) {
          selectFile(droppedFile);
        }
      }
    },
    [selectFile]
  );

  const hasResults = vocalsUrl && instrumentalUrl;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Voice Separation</h1>
      <p className={styles.subtitle}>
        Separate vocals from instrumentals using AI. Upload any song and download clean stems.
      </p>

      {/* ── RESULTS STATE ── */}
      {hasResults && (
        <>
          <div className={styles.resultsCard}>
            <div className={styles.resultsHeader}>
              <LuCircleCheck className={styles.successIcon} />
              <span className={styles.resultsTitle}>Separation Complete</span>
            </div>

            {/* Warning banner */}
            <div className={styles.warningBanner}>
              <LuTriangleAlert className={styles.warningIcon} />
              <span className={styles.warningText}>
                Download now — these files are temporary and will expire in 1 hour. They are not saved on our servers.
              </span>
            </div>

            {error && (
              <div className={styles.errorCard}>
                <LuCircleAlert className={styles.errorIcon} />
                <p className={styles.errorMessage}>{error}</p>
              </div>
            )}

            {/* Stem download cards */}
            <div className={styles.stemsGrid}>
              {/* Vocals */}
              <div className={styles.stemCard}>
                <div className={styles.stemHeader}>
                  <div className={styles.stemIconVocals}>
                    <RiVoiceprintLine />
                  </div>
                  <div className={styles.stemInfo}>
                    <span className={styles.stemName}>Vocals</span>
                    {vocalsSizeBytes && (
                      <span className={styles.stemSize}>
                        {formatBytes(vocalsSizeBytes)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className={styles.downloadBtn}
                  onClick={downloadVocals}
                  id="download-vocals-btn"
                >
                  <LuDownload className={styles.downloadBtnIcon} />
                  Download
                </button>
              </div>

              {/* Instrumental */}
              <div className={styles.stemCard}>
                <div className={styles.stemHeader}>
                  <div className={styles.stemIconInstrumental}>
                    <TbMusic />
                  </div>
                  <div className={styles.stemInfo}>
                    <span className={styles.stemName}>Instrumental</span>
                    {instrumentalSizeBytes && (
                      <span className={styles.stemSize}>
                        {formatBytes(instrumentalSizeBytes)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className={styles.downloadBtn}
                  onClick={downloadInstrumental}
                  id="download-instrumental-btn"
                >
                  <LuDownload className={styles.downloadBtnIcon} />
                  Download
                </button>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            className={styles.newSeparationBtn}
            onClick={clearAll}
            id="new-separation-btn"
          >
            <LuPlus className="text-lg" />
            New Separation
          </Button>
        </>
      )}

      {/* ── ERROR STATE ── */}
      {error && !hasResults && (
        <div className={styles.errorCard}>
          <LuCircleAlert className={styles.errorIcon} />
          <p className={styles.errorMessage}>{error}</p>
          <Button
            variant="outline"
            className={styles.retryBtn}
            onClick={clearAll}
            id="separation-retry-btn"
          >
            <LuRotateCcw className="text-sm" />
            Try Again
          </Button>
        </div>
      )}

      {/* ── PROCESSING STATE ── */}
      {isProcessing && !hasResults && (
        <div className={styles.processingCard}>
          <div className={styles.spinnerWrapper}>
            <Hatch size="28" stroke="4" speed="3.5" color="currentColor" />
          </div>
          <p className={styles.processingTitle}>Separating Audio</p>
          <p className={styles.processingSubtitle}>
            {statusMessage || "Processing your audio..."}
          </p>
        </div>
      )}

      {/* ── UPLOAD STATE ── */}
      {!isProcessing && !hasResults && !error && (
        <>
          {file ? (
            <div className={styles.fileCard}>
              <div className={styles.fileIcon}>
                <HiOutlineMusicalNote />
              </div>
              <div className={styles.fileInfo}>
                <p className={styles.fileName}>{file.name}</p>
                <p className={styles.fileSize}>{formatBytes(file.size)}</p>
                <p className={styles.pricingHint} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                  ⚡ 100 credits / 3 mins
                </p>
              </div>
              <button
                className={styles.removeBtn}
                onClick={clearAll}
                id="remove-file-btn"
              >
                <LuX />
              </button>
            </div>
          ) : (
            <div
              className={styles.dropZone}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              id="separation-drop-zone"
            >
              <LuCloudUpload className={styles.dropIcon} />
              <p className={styles.dropTitle}>
                Drop your audio file here or click to browse
              </p>
              <p className={styles.dropSubtitle}>
                WAV, MP3, OGG, FLAC, M4A · Max 50MB
              </p>
              <p className={styles.pricingHint} style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                ⚡ 100 credits per 3 mins of audio
              </p>
              <input
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac,.webm,.wma"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>
          )}

          <Button
            variant="outline"
            size="lg"
            className={styles.separateBtn}
            disabled={!file || isProcessing}
            onClick={separate}
            id="separate-btn"
          >
            {isProcessing ? (
              <Hatch size="20" stroke="3" speed="3.5" color="currentColor" />
            ) : (
              <RiVoiceprintLine className="text-lg" />
            )}
            {isProcessing ? "Separating..." : "Separate Audio"}
          </Button>
        </>
      )}
    </div>
  );
}
