"use client";

import { LuX, LuUpload, LuLoader, LuDownload } from "react-icons/lu";
import { Button } from "@/components/ui/button";

import { useVoiceClone } from "@/hooks/useVoiceClone";
import { AudioUploader } from "@/components/voice-clone/AudioUploader/AudioUploader";
import { AudioPlayer } from "@/components/voice-clone/AudioPlayer/AudioPlayer";
import { ProcessingStepper } from "@/components/voice-clone/ProcessingStepper/ProcessingStepper";
import { LanguageSelector } from "@/components/voice-clone/LanguageSelector/LanguageSelector";
import styles from "./page.module.css";

export default function InstantVoiceClonePage() {
  const {
    file,
    voiceId,
    text,
    targetLanguage,
    isUploading,
    isCloning,
    cloneStage,
    stageMessage,
    cloneError,
    clonedAudioUrl,
    selectFile,
    clearAll,
    upload,
    clone,
    download,
    retry,
    setText,
    setTargetLanguage,
    consecutiveFails,
  } = useVoiceClone();

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Clone Voice from Reference Audio</h1>

      <div className={styles.workspace}>
        {/* ── LEFT PANEL: Input ── */}
        <div className={styles.leftPanel}>
          {/* Upload / Preview */}
          {file ? (
            <AudioPlayer
              source={file}
              label="Reference Audio"
              headerAction={
                <button onClick={clearAll} className={styles.closeBtn}>
                  <LuX className={styles.closeIcon} />
                </button>
              }
            />
          ) : (
            <AudioUploader onFileSelect={selectFile} />
          )}

          {/* Target Language */}
          <LanguageSelector
            value={targetLanguage}
            onChange={setTargetLanguage}
            label="Target Language"
            placeholder="Select language"
          />

          {/* Script Input */}
          <textarea
            className={styles.textInput}
            placeholder="Enter the text you want the cloned voice to speak..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          {/* Action Buttons */}
          <div className={styles.actions}>
            <Button
              variant="outline"
              size="lg"
              className={styles.actionBtn}
              disabled={!file || isUploading || !!voiceId}
              onClick={upload}
            >
              {isUploading ? (
                <LuLoader className="text-lg animate-spin" />
              ) : (
                <LuUpload className="text-lg" />
              )}
              {voiceId
                ? "Uploaded"
                : isUploading
                ? "Uploading..."
                : "Upload Audio"}
            </Button>

            <Button
              variant="outline"
              size="lg"
              className={styles.actionBtn}
              disabled={!voiceId || !text || isCloning}
              onClick={clone}
            >
              {isCloning && <LuLoader className="text-lg animate-spin" />}
              {isCloning ? "Cloning..." : "Clone Voice"}
            </Button>
          </div>
        </div>

        {/* ── RIGHT PANEL: Output ── */}
        <div className={styles.rightPanel}>
          {/* Cloned Audio Result */}
          {clonedAudioUrl && (
            <AudioPlayer
              source={clonedAudioUrl}
              label="Cloned Voice Output"
              headerAction={
                <button onClick={download} className={styles.downloadBtn}>
                  <LuDownload className={styles.downloadIcon} />
                  Download
                </button>
              }
            />
          )}

          {/* Empty State */}
          {!clonedAudioUrl && !isCloning && !cloneError && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🎤</div>
              <p className={styles.emptyTitle}>Cloned output appears here</p>
              <p className={styles.emptySubtitle}>
                Upload a reference audio, enter text, and click Clone Voice
              </p>
            </div>
          )}

          {/* Processing Stepper / Error */}
          <ProcessingStepper
            currentStage={cloneStage || ""}
            stageMessage={stageMessage || ""}
            isProcessing={isCloning}
            error={cloneError}
            consecutiveFails={consecutiveFails}
            onRetry={retry}
          />
        </div>
      </div>
    </div>
  );
}
