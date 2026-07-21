"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { LuMic, LuSquare } from "react-icons/lu";
import { getRecordingScript, getRecordingLangName } from "./recordingScripts";
import styles from "./AudioRecorder.module.css";

const MAX_DURATION_SEC = 120; // 2 minutes

type AudioRecorderProps = {
  onRecordComplete: (file: File) => void;
  onCancel: () => void;
  /** Language code for the reading script (e.g. "hi", "en"). Defaults to "en". */
  language?: string;
};

/**
 * Picks the best supported file extension based on the recorder's MIME type.
 * Handles Safari (audio/mp4), Firefox (audio/ogg), Chrome/Edge (audio/webm).
 */
function getExtFromMime(mime: string): string {
  if (mime.includes("mp4") || mime.includes("aac")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

/**
 * In-browser audio recorder with a pre-built ~20-sec reading passage.
 * - Shows the translated passage for the selected language
 * - Max 2-minute recording with auto-stop
 * - Real-time timer using requestAnimationFrame (reliable on mobile)
 * - Produces a File object on completion
 */
export function AudioRecorder({ onRecordComplete, onCancel, language = "en" }: AudioRecorderProps) {
  const [status, setStatus] = useState<"idle" | "recording" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef(0);
  const rafIdRef = useRef<number>(0);
  const isRecordingRef = useRef(false);

  const readingScript = getRecordingScript(language);
  const languageName = getRecordingLangName(language);

  // requestAnimationFrame-based timer — more reliable than setInterval on mobile
  const tickTimer = useCallback(() => {
    if (!isRecordingRef.current) return;

    const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setElapsed(sec);

    // Auto-stop at 2 minutes
    if (sec >= MAX_DURATION_SEC) {
      // Use the ref directly to avoid stale closure
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      isRecordingRef.current = false;
      return;
    }

    rafIdRef.current = requestAnimationFrame(tickTimer);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    cancelAnimationFrame(rafIdRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
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

      mediaRecorder.onerror = () => {
        isRecordingRef.current = false;
        cancelAnimationFrame(rafIdRef.current);
        stream.getTracks().forEach((t) => t.stop());
        setError("Recording failed. Please try again.");
        setStatus("idle");
      };

      mediaRecorder.onstop = () => {
        isRecordingRef.current = false;
        cancelAnimationFrame(rafIdRef.current);

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());

        if (chunksRef.current.length === 0) {
          setError("No audio was captured. Please check your microphone.");
          setStatus("idle");
          return;
        }

        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ext = getExtFromMime(mimeType);
        const file = new File([blob], `recording_${Date.now()}.${ext}`, {
          type: blob.type,
        });

        setStatus("done");
        onRecordComplete(file);
      };

      mediaRecorder.start(1000); // Collect data in 1s chunks for reliability on mobile
      setStatus("recording");
      startTimeRef.current = Date.now();
      setElapsed(0);

      // Start rAF-based timer
      isRecordingRef.current = true;
      rafIdRef.current = requestAnimationFrame(tickTimer);
    } catch {
      setError("Microphone access denied. Please allow microphone permission.");
    }
  }, [onRecordComplete, tickTimer]);

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
      {/* ── Reading Script Passage ── */}
      <div className={styles.scriptSection}>
        <span className={styles.scriptLabel}>Read this out aloud</span>
        <div className={styles.scriptCard}>
          <p className={styles.scriptText}>{readingScript}</p>
        </div>
        <div className={styles.scriptMeta}>
          <span className={styles.langBadge}>
            Selected language · {languageName}
          </span>
          <span className={styles.durationHint}>~20 sec</span>
        </div>
      </div>

      {/* ── Recorder Controls ── */}
      {status === "idle" && (
        <div className={styles.controlsRow}>
          <button type="button" className={styles.recordBtn} onClick={startRecording}>
            <LuMic />
            Start Recording
          </button>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}

      {status === "recording" && (
        <div className={styles.recordingControls}>
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
        </div>
      )}

      {status === "done" && (
        <div className={styles.doneMessage}>
          <p className={styles.doneText}>Recording saved!</p>
        </div>
      )}

      {/* ── Tips Footer ── */}
      <p className={styles.tipsFooter}>
        Read passage clearly · Sit in a quiet place · Min. 10s recording
      </p>
    </div>
  );
}
