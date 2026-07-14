"use client";

import { useRef, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LuCloudUpload, LuPlus, LuX, LuCheck } from "react-icons/lu";
import { Hatch } from "ldrs/react";
import "ldrs/react/Hatch.css";
import { Button } from "@/components/ui/button";
import { useVoiceLibrary } from "@/hooks/useVoiceLibrary";
import styles from "./page.module.css";

import { LanguageSelector } from "@/components/voice-clone/LanguageSelector/LanguageSelector";

export default function VoiceCreationPage() {
  const router = useRouter();
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    createName,
    createDescription,
    createLanguage,
    createFile,
    isCreating,
    error,
    setCreateName,
    setCreateDescription,
    setCreateLanguage,
    setCreateFile,
    createVoice,
  } = useVoiceLibrary();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        setCreateFile(e.target.files[0]);
      }
    },
    [setCreateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.includes("audio")) {
          setCreateFile(file);
        }
      }
    },
    [setCreateFile]
  );

  const clearFile = useCallback(() => {
    setCreateFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [setCreateFile]);

  const handleCreate = useCallback(async () => {
    const createdVoice = await createVoice();
    if (!createdVoice) return;

    setIsSuccess(true);
    // Redirect to library after a brief success animation
    setTimeout(() => router.push("/voice-library"), 1500);
  }, [createVoice, router]);

  const canCreate = createName.trim() && createFile && !isCreating && !isSuccess;

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.heading}>Create Voice</h1>
        <p className={styles.subheading}>
          Upload a reference audio to create a reusable voice for cloning and TTS.
        </p>
      </div>

      {/* Success state */}
      {isSuccess ? (
        <div className={styles.successCard}>
          <div className={styles.successIcon}>
            <LuCheck />
          </div>
          <h2 className={styles.successTitle}>Voice Created!</h2>
          <p className={styles.successText}>Redirecting to your Voice Library...</p>
        </div>
      ) : (
        <div className={styles.formContainer}>
          <div className={styles.formCard}>
            {/* Voice Name */}
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="voice-name">
                Voice Name <span className={styles.required}>*</span>
              </label>
              <input
                id="voice-name"
                type="text"
                className={styles.textInput}
                placeholder="e.g. My YouTube Voice"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={60}
              />
            </div>

            {/* Description */}
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="voice-desc">
                Description <span className={styles.optional}>(optional)</span>
              </label>
              <textarea
                id="voice-desc"
                className={styles.textArea}
                placeholder="Describe this voice — e.g. warm male voice for tech content"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                maxLength={200}
                rows={3}
              />
            </div>

            {/* Language */}
            <div className={styles.field} style={{ zIndex: 10 }}>
              <LanguageSelector
                value={createLanguage}
                onChange={setCreateLanguage}
                label="Language"
                placeholder="Select primary language"
              />
            </div>

            {/* Reference Audio Upload */}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Reference Audio <span className={styles.required}>*</span>
              </label>
              <p className={styles.fieldHint}>
                Upload a clear audio sample of the 30 Second , 2 minute maximum limit
              </p>

              {createFile ? (
                <div className={styles.filePreview}>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{createFile.name}</span>
                    <span className={styles.fileSize}>
                      {formatSize(createFile.size)}
                    </span>
                  </div>
                  <button onClick={clearFile} className={styles.clearFileBtn}>
                    <LuX />
                  </button>
                </div>
              ) : (
                <div
                  className={styles.dropZone}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={styles.dropIconWrap}>
                    <LuCloudUpload className={styles.dropIcon} />
                  </div>
                  <span className={styles.dropText}>
                    Drop audio file or click to browse
                  </span>
                  <span className={styles.dropHint}>
                    WAV, MP3, OGG, FLAC, M4A, AAC, WEBM, WMA
                  </span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac,.webm,.wma"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Error */}
            {error && (
              <div className={styles.errorBanner}>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <p className={styles.fieldHint} style={{ textAlign: "center", marginBottom: "0.25rem" }}>
              Created voice will be available in the Text-to-Speech section for use.
            </p>
            <p className={styles.fieldHint} style={{ textAlign: "center", marginBottom: "1rem" }}>
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>⚡ 250 credits</span> will be used for each voice creation.
            </p>
            <Button
              variant="outline"
              size="lg"
              className={styles.createBtn}
              disabled={!canCreate}
              onClick={handleCreate}
            >
              {isCreating ? (
                <Hatch size="20" stroke="3" speed="3.5" color="currentColor" />
              ) : (
                <LuPlus />
              )}
              {isCreating ? "Creating Voice..." : "Create Voice"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
