"use client";

import { useCallback } from "react";
import { LuDownload } from "react-icons/lu";
import { Hatch } from "ldrs/react";
import "ldrs/react/Hatch.css";
import { Button } from "@/components/ui/button";

import { useVoiceClone } from "@/hooks/useVoiceClone";
import { useTtsStore } from "@/stores/voiceCloneStore";
import { AudioPlayer } from "@/components/voice-clone/AudioPlayer/AudioPlayer";
import { ProcessingStepper } from "@/components/voice-clone/ProcessingStepper/ProcessingStepper";
import { LanguageSelector } from "@/components/voice-clone/LanguageSelector/LanguageSelector";
import { VoicePicker } from "@/components/voice-clone/VoicePicker/VoicePicker";
import { SpeedControl } from "@/components/voice-clone/SpeedControl/SpeedControl";
import { ScriptBoxInfo } from "@/components/voice-clone/ScriptBoxInfo/ScriptBoxInfo";
import { CopyPromptButton } from "@/components/voice-clone/CopyPromptButton/CopyPromptButton";
import styles from "./page.module.css";

export default function TextToSpeechPage() {
  const {
    voiceId,
    text,
    targetLanguage,
    isCloning,
    cloneStage,
    stageMessage,
    cloneError,
    clonedAudioUrl,
    clone,
    download,
    retry,
    setText,
    setTargetLanguage,
    setVoiceId,
    speed,
    setSpeed,
    consecutiveFails,
  } = useVoiceClone(useTtsStore);



  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Text to Speech</h1>
      <p className={styles.subtitle}>
        Generate speech from text using preset or custom voices from your library.
      </p>

      <div className={styles.workspace}>
        {/* ── LEFT PANEL: Input ── */}
        <div className={styles.leftPanel}>
          {/* Voice picker — presets + custom voices */}
          <VoicePicker
            onSelect={(voice) => setVoiceId(voice.id)}
            selectedId={voiceId}
          />

          {/* Target Language */}
          <LanguageSelector
            value={targetLanguage}
            onChange={setTargetLanguage}
            onLanguageScriptChange={(script) => {
              if (script) setText(script);
            }}
            label="Target Language"
            placeholder="Select language"
          />

          {/* Script Input */}
          <div className={styles.textareaWrapper}>
            <textarea
              className={styles.textInput}
              placeholder="Type or paste the text you want spoken..."
              value={text}
              maxLength={1500}
              onChange={(e) => setText(e.target.value)}
            />
            <div className={styles.charCounter}>
              {text.length} / 1500
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "4px" }}>
            <ScriptBoxInfo />
            <CopyPromptButton />
          </div>

          {/* Dynamic credit estimate */}
          {text.trim().length > 0 && (
            <div className={styles.creditEstimate} style={{ minWidth: 0 }}>
              <span className={styles.creditEstimateIcon}>⚡</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ~{Math.max(1, Math.ceil(text.trim().length * 0.625)).toLocaleString()} credits
              </span>
            </div>
          )}

          {/* Speed Control */}
          <SpeedControl value={speed} onChange={setSpeed} />



          {/* Synthesize Button */}
          <div className={styles.actions}>
            <Button
              variant="outline"
              size="lg"
              className={styles.synthesizeBtn}
              disabled={!voiceId || !text || isCloning}
              onClick={clone}
            >
              {isCloning && <Hatch size="20" stroke="3" speed="3.5" color="currentColor" />}
              {isCloning ? "Synthesizing..." : "Synthesize Speech"}
            </Button>
          </div>
        </div>

        {/* ── RIGHT PANEL: Output ── */}
        <div className={styles.rightPanel}>
          {/* Synthesized Audio Result */}
          {clonedAudioUrl && (
            <AudioPlayer
              source={clonedAudioUrl}
              label="Synthesized Speech"
              headerAction={
                <button suppressHydrationWarning onClick={download} className={styles.downloadBtn}>
                  <LuDownload className={styles.downloadIcon} />
                  Download
                </button>
              }
            />
          )}

          {/* Empty State */}
          {!clonedAudioUrl && !isCloning && !cloneError && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>🔊</div>
              <p className={styles.emptyTitle}>Output appears here</p>
              <p className={styles.emptySubtitle}>
                Select a voice, enter text, and click Synthesize Speech
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
            mode="tts"
          />
        </div>
      </div>
    </div>
  );
}
