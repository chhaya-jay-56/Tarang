import { LuUpload, LuFileAudio, LuBrain, LuShieldCheck } from "react-icons/lu";
import styles from "./PipelineProgress.module.css";

export type PipelineStatus = "pending" | "transcribing" | "transcript_ready" | "extracting" | "completed" | "failed";

interface PipelineProgressProps {
  status: PipelineStatus;
  hasTranscript?: boolean;
}

const STEPS = [
  { key: "uploaded", label: "Uploaded", icon: LuUpload },
  { key: "transcribing", label: "Transcription", icon: LuFileAudio },
  { key: "extracting", label: "Intelligence", icon: LuBrain },
  { key: "completed", label: "Report Ready", icon: LuShieldCheck },
];

const STATUS_TO_STEP: Record<PipelineStatus, number> = {
  pending: 0,
  transcribing: 1,
  transcript_ready: 2, // Transcription done, waiting for user to trigger extraction
  extracting: 2,
  completed: 3,
  failed: -1,
};

export function PipelineProgress({ status, hasTranscript }: PipelineProgressProps) {
  const currentStep = STATUS_TO_STEP[status] ?? 0;
  const isFailed = status === "failed";

  // Determine which step failed based on available data
  const failedStepIndex = isFailed
    ? (hasTranscript ? 2 : 1)  // If transcript exists, Intelligence failed; else Transcription failed
    : -1;

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        {isFailed ? "Pipeline Failed" : status === "transcript_ready" ? "Transcript Ready" : "Processing Pipeline"}
      </div>
      <div className={styles.steps}>
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = !isFailed && currentStep > i;
          const isActive = !isFailed && currentStep === i;
          const isError = isFailed && i === failedStepIndex;
          // For transcript_ready, step 2 (Intelligence) should look "waiting" not "active"
          const isWaiting = status === "transcript_ready" && i === 2;

          const circleClass = [
            styles.stepCircle,
            isDone ? styles.done : "",
            isActive && !isWaiting ? styles.active : "",
            isWaiting ? styles.waiting : "",
            isError ? styles.error : "",
          ].filter(Boolean).join(" ");

          const labelClass = [
            styles.stepLabel,
            isDone ? styles.done : "",
            isActive ? styles.active : "",
          ].filter(Boolean).join(" ");

          return (
            <span key={step.key} style={{ display: "contents" }}>
              <div className={styles.step}>
                <div className={circleClass}>
                  <Icon />
                </div>
                <span className={labelClass}>{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    styles.connector,
                    isDone ? styles.done : "",
                    isActive ? styles.active : "",
                  ].filter(Boolean).join(" ")}
                />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
