import { LuUpload, LuFileAudio, LuBrain, LuShieldCheck } from "react-icons/lu";
import styles from "./PipelineProgress.module.css";

type PipelineStatus = "pending" | "transcribing" | "extracting" | "completed" | "failed";

interface PipelineProgressProps {
  status: PipelineStatus;
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
  extracting: 2,
  completed: 3,
  failed: -1,
};

export function PipelineProgress({ status }: PipelineProgressProps) {
  const currentStep = STATUS_TO_STEP[status] ?? 0;
  const isFailed = status === "failed";

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        {isFailed ? "Pipeline Failed" : "Processing Pipeline"}
      </div>
      <div className={styles.steps}>
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = !isFailed && currentStep > i;
          const isActive = !isFailed && currentStep === i;
          const isError = isFailed && i === Math.abs(currentStep);

          const circleClass = [
            styles.stepCircle,
            isDone ? styles.done : "",
            isActive ? styles.active : "",
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
