import styles from "./TranscriptViewer.module.css";

interface TranscriptViewerProps {
  transcript: any;
  audioUrl?: string;
  status: string;
}

export function TranscriptViewer({ transcript, audioUrl, status }: TranscriptViewerProps) {
  const utterances = getUtterances(transcript);
  const fullText = getFullTranscriptText(transcript);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Call Recording and Diarized Transcript</h3>

      {audioUrl && (
        <audio controls src={audioUrl} className={styles.audioPlayer} />
      )}

      <div className={styles.transcriptBox}>
        {utterances.length > 0 ? (
          utterances.map((utt: any, idx: number) => (
            <div key={idx} className={styles.utterance}>
              <div className={styles.speakerRow}>
                <span className={styles.speakerLabel}>
                  Speaker {utt.speaker !== undefined ? utt.speaker : "Unknown"}
                </span>
                <span className={styles.timestamp}>
                  [{Math.floor(utt.start || 0)}s - {Math.floor(utt.end || 0)}s]
                </span>
              </div>
              <p className={styles.utteranceText}>{utt.text}</p>
            </div>
          ))
        ) : fullText ? (
          <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{fullText}</p>
        ) : (
          <p className={styles.emptyState}>
            {status === "completed"
              ? "Transcript processed."
              : `Transcript will appear once transcription completes (Status: ${status}).`}
          </p>
        )}
      </div>
    </div>
  );
}

/* -- Helpers -- */

function getUtterances(transcript: any): any[] {
  if (!transcript) return [];
  if (Array.isArray(transcript?.result?.transcription?.utterances))
    return transcript.result.transcription.utterances;
  if (Array.isArray(transcript?.transcription?.utterances))
    return transcript.transcription.utterances;
  if (Array.isArray(transcript?.prediction?.utterances))
    return transcript.prediction.utterances;
  if (Array.isArray(transcript?.utterances))
    return transcript.utterances;
  return [];
}

function getFullTranscriptText(transcript: any): string {
  if (!transcript) return "";
  if (typeof transcript?.result?.transcription?.full_transcript === "string")
    return transcript.result.transcription.full_transcript;
  if (typeof transcript?.transcription?.full_transcript === "string")
    return transcript.transcription.full_transcript;
  if (typeof transcript?.prediction?.transcription === "string")
    return transcript.prediction.transcription;
  if (typeof transcript === "string") return transcript;
  return "";
}
