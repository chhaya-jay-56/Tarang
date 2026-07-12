"use client";

import { LuCheck, LuRotateCcw } from "react-icons/lu";
import { Hatch } from "ldrs/react";
import "ldrs/react/Hatch.css";
import { Button } from "@/components/ui/button";
import styles from "./ProcessingStepper.module.css";

const VISUAL_STAGES = [
  { id: "starting", label: "Starting", keys: ["queued", "downloading_reference", "uploading_to_ai", "model_loading"] },
  { id: "running", label: "Cloning", keys: ["model_running"] },
  { id: "saving", label: "Saving", keys: ["saving_to_storage", "completed"] },
];

type ProcessingStepperProps = {
  currentStage: string;
  stageMessage: string;
  isProcessing: boolean;
  error: string | null;
  consecutiveFails?: number;
  onRetry?: () => void;
  mode?: "clone" | "tts";
};

export function ProcessingStepper({
  currentStage,
  stageMessage,
  isProcessing,
  error,
  consecutiveFails = 0,
  onRetry,
  mode = "clone",
}: ProcessingStepperProps) {
  
  const stages = VISUAL_STAGES.map(s => {
    if (s.id === "running" && mode === "tts") {
      return { ...s, label: "Synthesizing" };
    }
    return s;
  });

  const activeIdx = stages.findIndex((s) => s.keys.includes(currentStage));
  const safeActiveIdx = activeIdx === -1 ? 0 : activeIdx;
  const isCompletedFinal = currentStage === "completed";

  // ── Error State ──
  if (error && !isProcessing) {
    return (
      <div className={styles.errorCard}>
        <div className={styles.errorHeader}>
          <span className={styles.errorIcon}>✕</span>
          <div>
            <p className={styles.errorTitle}>{mode === "tts" ? "TTS Failed" : "Clone Failed"}</p>
            <p className={styles.errorMessage}>{error}</p>
          </div>
        </div>
        {onRetry && (
          <div className={styles.errorActions}>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-[12px] rounded-full"
              onClick={onRetry}
            >
              <LuRotateCcw className="text-sm" />
              Retry
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ── Processing State ──
  if (!isProcessing || !currentStage) return null;

  return (
    <div className={styles.stepper}>
      {/* Header with spinner */}
      <div className={styles.header}>
        <Hatch size="28" stroke="4" speed="3.5" color="currentColor" />
        <p className={styles.headerText}>{stageMessage || "Processing..."}</p>
      </div>

      {/* Step track */}
      <div className={styles.track}>
        {stages.map((stage, idx) => {
          const isCurrent = idx === safeActiveIdx && !isCompletedFinal;
          const isCompleted = safeActiveIdx > idx || isCompletedFinal;

          return (
            <div key={stage.id} className={styles.step}>
              <div className={styles.stepContent}>
                {/* Dot */}
                <div
                  className={`${styles.dot} ${
                    isCompleted
                      ? styles.dotCompleted
                      : isCurrent
                      ? styles.dotCurrent
                      : styles.dotPending
                  }`}
                >
                  {isCompleted && <LuCheck />}
                </div>

                {/* Label */}
                <span
                  className={`${styles.stepLabel} ${
                    isCurrent ? styles.stepLabelCurrent : ""
                  }`}
                >
                  {stage.label}
                </span>

                {/* Status text */}
                <span
                  className={`${styles.stepStatus} ${
                    isCompleted
                      ? styles.statusCompleted
                      : isCurrent
                      ? styles.statusCurrent
                      : styles.statusPending
                  }`}
                >
                  {isCompleted
                    ? "Done"
                    : isCurrent
                    ? "Active"
                    : "Pending"}
                </span>
              </div>

              {/* Connector line */}
              {idx < stages.length - 1 && (
                <div
                  className={`${styles.connector} ${
                    isCompleted
                      ? styles.connectorCompleted
                      : styles.connectorPending
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Connection warning */}
      {consecutiveFails >= 3 && consecutiveFails < 5 && (
        <p className={styles.warning}>Connection unstable, retrying...</p>
      )}
    </div>
  );
}
