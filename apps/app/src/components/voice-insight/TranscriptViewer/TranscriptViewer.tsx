"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./TranscriptViewer.module.css";

type Utterance = { speaker?: string | number; start?: number; end?: number; text?: string };

interface TranscriptViewerProps {
  transcript: unknown;
  audioUrl?: string;
  status: string;
}

export function TranscriptViewer({ transcript, audioUrl, status }: TranscriptViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const utteranceRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [audioError, setAudioError] = useState(false);
  const utterances = useMemo(() => getUtterances(transcript), [transcript]);
  const fullText = useMemo(() => getFullTranscriptText(transcript), [transcript]);

  useEffect(() => {
    if (activeIndex === null) return;
    utteranceRefs.current[activeIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeIndex]);

  const syncTranscript = () => {
    const currentTime = audioRef.current?.currentTime ?? 0;
    const nextIndex = utterances.findIndex((utterance, index) => {
      const start = toSeconds(utterance.start);
      const declaredEnd = toSeconds(utterance.end);
      const nextStart = index < utterances.length - 1 ? toSeconds(utterances[index + 1].start) : Number.POSITIVE_INFINITY;
      // Some Gladia utterances have identical start/end values. Use the next
      // segment boundary in that case so highlighting remains continuous.
      const end = declaredEnd > start ? declaredEnd : nextStart;
      return currentTime >= start && currentTime < end;
    });
    setActiveIndex(nextIndex === -1 ? null : nextIndex);
  };

  const seekToUtterance = (start: number | undefined) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = toSeconds(start);
    audioRef.current.play().catch(() => undefined);
  };

  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Call recording and transcript</h3>
          {utterances.length > 0 && <p className={styles.hint}>Playback follows the highlighted segment. Select a segment to jump to it.</p>}
        </div>
      </div>

      {audioUrl && !audioError ? (
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={audioUrl}
          className={styles.audioPlayer}
          onTimeUpdate={syncTranscript}
          onSeeking={syncTranscript}
          onEnded={() => setActiveIndex(null)}
          onError={() => setAudioError(true)}
        />
      ) : (
        <p className={styles.audioUnavailable}>
          {audioError ? "This recording could not be loaded. Uploads made before the playback fix may need to be uploaded again." : "No playable recording is available for this case."}
        </p>
      )}

      <div className={styles.transcriptBox} aria-label="Diarized transcript">
        {utterances.length > 0 ? utterances.map((utterance, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={`${utterance.start}-${index}`}
              ref={(element) => { utteranceRefs.current[index] = element; }}
              type="button"
              className={`${styles.utterance} ${isActive ? styles.utteranceActive : ""}`}
              onClick={() => seekToUtterance(utterance.start)}
              aria-current={isActive ? "true" : undefined}
            >
              <span className={styles.speakerRow}>
                <span className={styles.speakerLabel}>Speaker {utterance.speaker ?? "Unknown"}</span>
                <span className={styles.timestamp}>[{formatTime(utterance.start)} – {formatTime(utterance.end)}]</span>
              </span>
              <span className={styles.utteranceText}>{utterance.text || "[No speech detected]"}</span>
            </button>
          );
        }) : fullText ? (
          <p className={styles.fullText}>{fullText}</p>
        ) : (
          <p className={styles.emptyState}>{status === "completed" ? "Transcript processed." : `Transcript will appear once transcription completes (status: ${status}).`}</p>
        )}
      </div>
    </section>
  );
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getUtterances(transcript: unknown): Utterance[] {
  const root = toRecord(transcript);
  const result = toRecord(root?.result) ?? toRecord(root?.prediction) ?? root;
  const transcription = toRecord(result?.transcription);
  const candidates = [transcription?.utterances, result?.utterances];
  const utterances = candidates.find(Array.isArray);
  return Array.isArray(utterances) ? utterances.map(toUtterance).filter((item): item is Utterance => item !== null) : [];
}

function toUtterance(value: unknown): Utterance | null {
  const item = toRecord(value);
  if (!item) return null;
  return { speaker: typeof item.speaker === "string" || typeof item.speaker === "number" ? item.speaker : undefined, start: toSeconds(item.start), end: toSeconds(item.end), text: typeof item.text === "string" ? item.text : undefined };
}

function getFullTranscriptText(transcript: unknown): string {
  if (typeof transcript === "string") return transcript;
  const root = toRecord(transcript);
  const result = toRecord(root?.result) ?? toRecord(root?.prediction) ?? root;
  const transcription = toRecord(result?.transcription);
  return typeof transcription?.full_transcript === "string" ? transcription.full_transcript : typeof result?.full_transcript === "string" ? result.full_transcript : typeof result?.transcription === "string" ? result.transcription : "";
}

function toSeconds(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function formatTime(value: unknown): string {
  const seconds = Math.round(toSeconds(value));
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
