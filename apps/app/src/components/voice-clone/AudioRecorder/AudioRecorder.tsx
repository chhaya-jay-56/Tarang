"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { LuMic, LuSquare } from "react-icons/lu";
import styles from "./AudioRecorder.module.css";

const MAX_DURATION_SEC = 120; // 2 minutes

type AudioRecorderProps = {
  onRecordComplete: (file: File) => void;
  onCancel: () => void;
};

/**
 * In-browser audio recorder using MediaRecorder API.
 * - Max 2-minute recording with auto-stop
 * - Shows real-time timer (mm:ss)
 * - Produces a File object on completion
 */
export function AudioRecorder({ onRecordComplete, onCancel }: AudioRecorderProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        const ext = mediaRecorder.mimeType?.includes("ogg") ? "ogg" : "webm";
        const file = new File([blob], `recording_${Date.now()}.${ext}`, {
          type: blob.type,
        });

        setStatus("done");
        onRecordComplete(file);
      };

      mediaRecorder.start(); // Single blob on stop — required for proper waveform decoding
      setStatus("recording");
      startTimeRef.current = Date.now();
      setElapsed(0);

      // Timer
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(sec);

        // Auto-stop at 2 minutes
        if (sec >= MAX_DURATION_SEC) {
          stopRecording();
        }
      }, 500);
    } catch {
      setError("Microphone access denied. Please allow microphone permission.");
    }
  }, [onRecordComplete, stopRecording]);

  if (error) {
    return (
      <div className={styles.container}>
        <p className={styles.errorText}>{error}</p>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>
          Back to Upload
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {status === "idle" && (
        <>
          <div className={styles.iconWrapper}>
            <LuMic className={styles.micIcon} />
          </div>
          <p className={styles.title}>Record your voice</p>
          <p className={styles.subtitle}>Max 2 minutes • Auto-stops at limit</p>
          <div className={styles.btnRow}>
            <button type="button" className={styles.recordBtn} onClick={startRecording}>
              <LuMic />
              Start Recording
            </button>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </>
      )}

      {status === "recording" && (
        <>
          <div className={styles.recordingIndicator}>
            <span className={styles.pulseDot} />
            <span className={styles.recordingLabel}>Recording</span>
          </div>
          <div className={styles.timer}>
            {formatTime(elapsed)}
            <span className={styles.timerMax}> / {formatTime(MAX_DURATION_SEC)}</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(100, (elapsed / MAX_DURATION_SEC) * 100)}%` }}
            />
          </div>
          <button type="button" className={styles.stopBtn} onClick={stopRecording}>
            <LuSquare />
            Stop Recording
          </button>
        </>
      )}

      {status === "done" && (
        <div className={styles.doneMessage}>
          <p className={styles.title}>Recording saved!</p>
        </div>
      )}
    </div>
  );
}
