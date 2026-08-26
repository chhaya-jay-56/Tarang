"use client";

import { useEffect, useState, useCallback } from "react";
import { useApiClient } from "@/lib/api";
import { useParams } from "next/navigation";
import { LuArrowLeft, LuBrain, LuDownload, LuLink, LuLoaderCircle, LuMapPin } from "react-icons/lu";
import Link from "next/link";
import { PipelineProgress, type PipelineStatus } from "@/components/voice-insight/PipelineProgress/PipelineProgress";
import { IntelligenceReport } from "@/components/voice-insight/IntelligenceReport/IntelligenceReport";
import { TranscriptViewer } from "@/components/voice-insight/TranscriptViewer/TranscriptViewer";
import styles from "./page.module.css";

type Intelligence = Record<string, unknown> & { error?: string };
type CallData = {
  id: string;
  filename?: string;
  status: PipelineStatus;
  created_at: string;
  duration_seconds?: number;
  audio_url?: string;
  transcript?: unknown;
  intelligence?: Intelligence;
};
type CrossReference = {
  call_id: string;
  filename?: string;
  match_count: number;
  matching_markers: Array<{ value: string }>;
};
type CrossReferenceData = { cross_references?: CrossReference[] };

export default function VoiceInsightDetail() {
  const { id } = useParams<{ id: string }>();
  const { authFetch } = useApiClient();
  const [call, setCall] = useState<CallData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [crossRefs, setCrossRefs] = useState<CrossReferenceData | null>(null);

  const fetchCall = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v1/voice-insight/calls/${id}`);
      setCall(await res.json() as CallData);
    } catch {
      setCall(null);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, id]);

  const fetchCrossRefs = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v1/voice-insight/calls/${id}/cross-references`);
      setCrossRefs(await res.json() as CrossReferenceData);
    } catch {
      // Cross references are supplementary and should not block the report.
    }
  }, [authFetch, id]);

  useEffect(() => {
    if (id) fetchCall();
  }, [fetchCall, id]);

  useEffect(() => {
    if (call?.status === "completed") fetchCrossRefs();
  }, [call?.status, fetchCrossRefs]);

  useEffect(() => {
    if (call?.status !== "transcribing") return;
    const interval = setInterval(fetchCall, 4_000);
    return () => clearInterval(interval);
  }, [call?.status, fetchCall]);

  const handleExtractIntelligence = async () => {
    setIsExtracting(true);
    setExtractError(null);
    try {
      const res = await authFetch(`/api/v1/voice-insight/calls/${id}/extract-intelligence`, { method: "POST" });
      const data = await res.json() as CallData;
      setCall(data);

      // Recoverable Modal failures are returned as a persisted failed record.
      // Surface that message instead of making the Analyze click look inert.
      if (data?.intelligence?.error) setExtractError(data.intelligence.error);
    } catch (err: unknown) {
      console.error("Intelligence extraction failed:", err);
      setExtractError(err instanceof Error ? err.message : "Intelligence extraction failed. Please try again.");
      await fetchCall();
    } finally {
      setIsExtracting(false);
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(true);
    try {
      const res = await authFetch(`/api/v1/voice-insight/calls/${id}/export?format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = url;
      download.download = `Case_${call?.filename || id}.${format}`;
      document.body.appendChild(download);
      download.click();
      download.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setExtractError("The report could not be exported. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <div className={styles.statusPage}>Loading case details…</div>;
  if (!call) return <div className={`${styles.statusPage} ${styles.errorStatus}`}>Case record not found.</div>;

  const hasTranscript = Boolean(call.transcript);
  const hasUsableIntelligence = call.intelligence && !call.intelligence.error;
  const showExtractButton = call.status === "transcript_ready" || (call.status === "failed" && hasTranscript && !hasUsableIntelligence);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/voice-insight" className={styles.backLink}><LuArrowLeft /> Back to VoiceInsight</Link>
        <div className={styles.headerRow}>
          <div className={styles.caseMeta}>
            <h1>Case: {call.filename || call.id}</h1>
            <p><span>{new Date(call.created_at).toLocaleString()}</span>{call.duration_seconds && <span>{Math.round(call.duration_seconds)} sec</span>}</p>
          </div>
          <div className={styles.exportActions}>
            <button onClick={() => handleExport("json")} disabled={isExporting} className={styles.exportButton}><LuDownload /> JSON</button>
            <button onClick={() => handleExport("csv")} disabled={isExporting} className={styles.exportButton}><LuDownload /> CSV</button>
          </div>
        </div>
      </header>

      <PipelineProgress status={call.status} hasTranscript={hasTranscript} />

      {showExtractButton && (
        <section className={styles.analysisCard} aria-live="polite">
          <div className={styles.analysisIcon}><LuBrain /></div>
          <div className={styles.analysisCopy}>
            <p className={styles.analysisEyebrow}>TRANSCRIPT READY</p>
            <h2>Generate intelligence report</h2>
            <p>Run Sarvam analysis to identify entities, risks, key moments, and actionable leads.</p>
          </div>
          <button onClick={handleExtractIntelligence} disabled={isExtracting} className={styles.analyzeButton}>
            {isExtracting ? <LuLoaderCircle className={styles.spinner} /> : <LuBrain />}
            {isExtracting ? "Analyzing transcript…" : call.status === "failed" ? "Retry analysis" : "Analyze intelligence"}
          </button>
          {isExtracting && <p className={styles.progressMessage}>This can take up to two minutes while the secure analysis service starts.</p>}
          {extractError && <p className={styles.errorMessage} role="alert">{extractError}</p>}
        </section>
      )}

      {call.status === "extracting" && !isExtracting && <section className={styles.extractingCard} aria-live="polite"><LuLoaderCircle className={styles.spinner} /> Intelligence extraction is in progress…</section>}

      {call.status === "completed" && call.intelligence && <><IntelligenceReport intelligence={call.intelligence} /><CrossReferences crossRefs={crossRefs} /></>}
      <TranscriptViewer transcript={call.transcript} audioUrl={call.audio_url} status={call.status} />
    </div>
  );
}

function CrossReferences({ crossRefs }: { crossRefs: CrossReferenceData | null }) {
  if (!crossRefs?.cross_references?.length) return null;
  return (
    <section className={styles.crossReferences}>
      <h2><LuLink /> Cross-referenced calls <span>{crossRefs.cross_references.length}</span></h2>
      <p>Calls sharing names, locations, or phone numbers with this recording.</p>
      <div className={styles.referenceList}>
        {crossRefs.cross_references.map((ref) => (
          <Link key={ref.call_id} href={`/voice-insight/${ref.call_id}`} className={styles.referenceItem}>
            <div><strong>{ref.filename || `Case #${ref.call_id.slice(0, 8)}`}</strong><div className={styles.markers}>{ref.matching_markers.map((marker, index) => <span key={index}><LuMapPin /> {marker.value}</span>)}</div></div>
            <small>{ref.match_count} match{ref.match_count > 1 ? "es" : ""}</small>
          </Link>
        ))}
      </div>
    </section>
  );
}
