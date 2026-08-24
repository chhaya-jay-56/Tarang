"use client";

import { useEffect, useState, useCallback } from "react";
import { useApiClient } from "@/lib/api";
import { useParams } from "next/navigation";
import { LuArrowLeft, LuDownload, LuLink, LuMapPin } from "react-icons/lu";
import Link from "next/link";
import { PipelineProgress } from "@/components/voice-insight/PipelineProgress/PipelineProgress";
import { IntelligenceReport } from "@/components/voice-insight/IntelligenceReport/IntelligenceReport";
import { TranscriptViewer } from "@/components/voice-insight/TranscriptViewer/TranscriptViewer";

export default function VoiceInsightDetail() {
  const { id } = useParams();
  const { authFetch } = useApiClient();
  const [call, setCall] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [crossRefs, setCrossRefs] = useState<any>(null);

  const fetchCall = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v1/voice-insight/calls/${id}`);
      setCall(await res.json());
    } catch {
      setCall(null);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, id]);

  const fetchCrossRefs = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v1/voice-insight/calls/${id}/cross-references`);
      setCrossRefs(await res.json());
    } catch {
      /* cross-refs are non-critical */
    }
  }, [authFetch, id]);

  // Initial load
  useEffect(() => {
    if (id) fetchCall();
  }, [fetchCall, id]);

  // Load cross-refs when completed
  useEffect(() => {
    if (call?.status === "completed") fetchCrossRefs();
  }, [call?.status, fetchCrossRefs]);

  // Auto-refresh while processing (self-healing backend will recover stale states)
  useEffect(() => {
    if (call && (call.status === "transcribing" || call.status === "extracting")) {
      const interval = setInterval(fetchCall, 4000);
      return () => clearInterval(interval);
    }
  }, [call?.status, fetchCall]);

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(true);
    try {
      const res = await authFetch(`/api/v1/voice-insight/calls/${id}/export?format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Case_${call?.filename || id}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Failed to export case intelligence report.");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: "40px", color: "var(--muted-foreground)", textAlign: "center" }}>
        Loading case details...
      </div>
    );
  }
  if (!call) {
    return (
      <div style={{ padding: "40px", color: "var(--destructive)", textAlign: "center" }}>
        Case record not found.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px", maxWidth: "960px", width: "100%", padding: "0 16px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingBottom: "16px", borderBottom: "1px solid var(--border)" }}>
        <Link href="/voice-insight" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--muted-foreground)", fontSize: "13px", textDecoration: "none" }}>
          <LuArrowLeft /> Back to VoiceInsight
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)", marginBottom: "4px" }}>
              Case: {call.filename || call.id}
            </h1>
            <p style={{ color: "var(--muted-foreground)", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{new Date(call.created_at).toLocaleString()}</span>
              {call.duration_seconds && <span>-- {Math.round(call.duration_seconds)}s</span>}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => handleExport("json")} disabled={isExporting} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              <LuDownload /> JSON
            </button>
            <button onClick={() => handleExport("csv")} disabled={isExporting} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", padding: "8px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              <LuDownload /> CSV
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline Progress */}
      <PipelineProgress status={call.status} />

      {/* Intelligence Report (only when completed) */}
      {call.status === "completed" && call.intelligence && (
        <>
          <IntelligenceReport intelligence={call.intelligence} />
          <CrossReferences crossRefs={crossRefs} />
        </>
      )}

      {/* Transcript */}
      <TranscriptViewer transcript={call.transcript} audioUrl={call.audio_url} status={call.status} />
    </div>
  );
}

/* -- Cross-References (kept inline since it's only used here) -- */

function CrossReferences({ crossRefs }: { crossRefs: any }) {
  if (!crossRefs?.cross_references?.length) return null;

  return (
    <div style={{ background: "var(--card)", padding: "22px", borderRadius: "14px", border: "1px solid var(--border)" }}>
      <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
        <LuLink style={{ color: "#a855f7" }} /> Cross-Referenced Calls ({crossRefs.cross_references.length})
      </h3>
      <p style={{ color: "var(--muted-foreground)", fontSize: "12px", marginBottom: "14px" }}>
        Calls sharing common names, locations, or phone numbers with this recording.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {crossRefs.cross_references.map((ref: any) => (
          <Link key={ref.call_id} href={`/voice-insight/${ref.call_id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--background)", borderRadius: "10px", border: "1px solid var(--border)", textDecoration: "none" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)", marginBottom: "4px" }}>
                {ref.filename || `Case #${ref.call_id.slice(0, 8)}`}
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {ref.matching_markers.map((m: any, i: number) => (
                  <span key={i} style={{ padding: "2px 8px", borderRadius: "100px", fontSize: "10px", fontWeight: 600, background: "rgba(168, 85, 247, 0.1)", color: "#a855f7", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                    <LuMapPin style={{ fontSize: "9px" }} /> {m.value}
                  </span>
                ))}
              </div>
            </div>
            <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>
              {ref.match_count} match{ref.match_count > 1 ? "es" : ""}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
