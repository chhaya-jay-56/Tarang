"use client";

import { useEffect, useState, useCallback } from "react";
import { useApiClient } from "@/lib/api";
import { useParams } from "next/navigation";
import {
  LuFileAudio,
  LuShieldAlert,
  LuMessageSquare,
  LuDownload,
  LuFileText,
  LuArrowLeft,
  LuTag,
  LuCircleCheck,
  LuClock,
  LuUsers,
  LuLink,
  LuMapPin,
  LuAlertTriangle,
} from "react-icons/lu";
import Link from "next/link";

export default function VoiceInsightDetail() {
  const { id } = useParams();
  const { authFetch } = useApiClient();
  const [call, setCall] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [crossRefs, setCrossRefs] = useState<any>(null);

  const fetchCall = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch(`/api/v1/voice-insight/calls/${id}`);
      const data = await res.json();
      setCall(data);
    } catch (err) {
      console.error("Failed to fetch call detail:", err);
      setCall(null);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, id]);

  const fetchCrossRefs = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v1/voice-insight/calls/${id}/cross-references`);
      const data = await res.json();
      setCrossRefs(data);
    } catch (err) {
      console.error("Failed to fetch cross-references:", err);
    }
  }, [authFetch, id]);

  useEffect(() => {
    if (id) {
      fetchCall();
    }
  }, [fetchCall, id]);

  useEffect(() => {
    if (call && call.status === "completed") {
      fetchCrossRefs();
    }
  }, [call, fetchCrossRefs]);

  useEffect(() => {
    if (call && (call.status === "transcribing" || call.status === "extracting")) {
      const interval = setInterval(() => {
        fetchCall();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [call, fetchCall]);

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
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export case intelligence report.");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) return <div style={{ padding: "40px", color: "var(--muted-foreground)" }}>Loading case details...</div>;
  if (!call) return <div style={{ padding: "40px", color: "var(--destructive)" }}>Case record not found.</div>;

  const threatColor =
    call.intelligence?.threat_level === "CRITICAL" ? "#ef4444" :
      call.intelligence?.threat_level === "HIGH" ? "#f97316" :
        call.intelligence?.threat_level === "MEDIUM" ? "#eab308" : "#22c55e";

  const intel = call.intelligence || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "950px", width: "100%", padding: "0 16px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* Back button & Title Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingBottom: "20px", borderBottom: "1px solid var(--border)" }}>
        <Link href="/voice-insight" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--muted-foreground)", fontSize: "14px", textDecoration: "none" }}>
          <LuArrowLeft /> Back to VoiceInsight Dashboard
        </Link>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--foreground)", marginBottom: "6px" }}>
              Case File: {call.filename || call.id}
            </h1>
            <p style={{ color: "var(--muted-foreground)", fontSize: "14px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span>Analyzed on {new Date(call.created_at).toLocaleString()}</span>
              <span>• Status: <strong>{call.status}</strong></span>
              {call.duration_seconds && <span>• Duration: {Math.round(call.duration_seconds)}s</span>}
            </p>
          </div>

          {/* Export Actions */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => handleExport("json")}
              disabled={isExporting}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                backgroundColor: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)",
                padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer"
              }}>
              <LuDownload /> Export JSON
            </button>
            <button
              onClick={() => handleExport("csv")}
              disabled={isExporting}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                backgroundColor: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)",
                padding: "8px 14px", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer"
              }}>
              <LuDownload /> Export CSV
            </button>
          </div>
        </div>
      </div>

      {call.status === "completed" && call.intelligence ? (
        <>
          {/* Key Metrics */}
          <MetricCards intel={intel} threatColor={threatColor} />

          {/* Whole-Call Summary */}
          <WholeCallSummary intel={intel} />

          {/* Timestamped Summary */}
          <TimestampedSummary intel={intel} />

          {/* Entity Table */}
          <EntityTable intel={intel} />

          {/* Risk Keywords */}
          <RiskKeywords intel={intel} />

          {/* Actionable Intelligence */}
          <ActionableIntelligence intel={intel} />

          {/* Cross-References */}
          <CrossReferences crossRefs={crossRefs} />
        </>
      ) : (
        <div style={{ padding: "40px", textAlign: "center", backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}>
          <p style={{ color: "var(--muted-foreground)" }}>
            Analysis is currently <strong>{call.status}</strong>. Intelligence report will automatically appear once processing completes.
          </p>
        </div>
      )}

      {/* Playback & Diarized Transcript */}
      <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", marginTop: "12px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", marginBottom: "16px" }}>Call Recording & Diarized Transcript</h3>

        {call.audio_url && (
          <audio controls src={call.audio_url} style={{ width: "100%", marginBottom: "20px" }} />
        )}

        <div style={{ color: "var(--foreground)", fontSize: "14px", lineHeight: 1.8, maxHeight: "450px", overflowY: "auto", padding: "16px", backgroundColor: "var(--background)", borderRadius: "8px", border: "1px solid var(--border)" }}>
          {getUtterances(call.transcript).length > 0 ? (
            getUtterances(call.transcript).map((utt: any, idx: number) => (
              <div key={idx} style={{ marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <strong style={{ color: "var(--primary)", fontSize: "13px" }}>
                    Speaker {utt.speaker !== undefined ? utt.speaker : 'Unknown'}
                  </strong>
                  <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>
                    [{Math.floor(utt.start || 0)}s - {Math.floor(utt.end || 0)}s]
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--foreground)" }}>{utt.text}</p>
              </div>
            ))
          ) : getFullTranscriptText(call.transcript) ? (
            <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{getFullTranscriptText(call.transcript)}</p>
          ) : (
            <p style={{ color: "var(--muted-foreground)", margin: 0 }}>
              {call.status === "completed"
                ? "Transcript processed."
                : `Transcript will be available once transcribing completes (Status: ${call.status}).`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-Components ─── */

function MetricCards({ intel, threatColor }: { intel: any; threatColor: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
      <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500 }}>
          <LuShieldAlert /> Threat Assessment
        </div>
        <div style={{ fontSize: "24px", fontWeight: 800, color: threatColor, display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: threatColor }} />
          {intel.threat_level || "UNKNOWN"}
        </div>
      </div>

      <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500 }}>
          <LuMessageSquare /> Primary Language
        </div>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--foreground)" }}>
          {intel.primary_language || "Multilingual"}
        </div>
      </div>

      <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500 }}>
          <LuFileAudio /> Overall Sentiment
        </div>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--foreground)" }}>
          {intel.overall_sentiment || "Neutral"}
        </div>
      </div>
    </div>
  );
}

function WholeCallSummary({ intel }: { intel: any }) {
  const summary = intel.whole_call_summary || intel.summary;
  if (!summary) return null;

  return (
    <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <LuFileText style={{ color: "var(--primary)" }} /> Whole-Call Summary
      </h3>
      <p style={{ color: "var(--foreground)", fontSize: "15px", lineHeight: 1.7 }}>
        {summary}
      </p>
    </div>
  );
}

function TimestampedSummary({ intel }: { intel: any }) {
  const events = intel.timestamped_summary;
  if (!events || !Array.isArray(events) || events.length === 0) return null;

  return (
    <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <LuClock style={{ color: "var(--primary)" }} /> Timestamped Summary
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "0", position: "relative" }}>
        {/* Timeline line */}
        <div style={{ position: "absolute", left: "36px", top: "8px", bottom: "8px", width: "2px", backgroundColor: "var(--border)" }} />
        {events.map((evt: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start", padding: "8px 0", position: "relative" }}>
            <span style={{
              minWidth: "50px", fontSize: "12px", fontWeight: 700, color: "var(--primary)",
              fontFamily: "monospace", paddingTop: "2px", textAlign: "right",
            }}>
              {evt.timestamp || "—"}
            </span>
            <div style={{
              width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "var(--primary)",
              marginTop: "5px", zIndex: 1, flexShrink: 0, border: "2px solid var(--card)",
            }} />
            <span style={{ color: "var(--foreground)", fontSize: "14px", lineHeight: 1.5 }}>
              {evt.event}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntityTable({ intel }: { intel: any }) {
  const entities = intel.entity_table;
  if (!entities || !Array.isArray(entities) || entities.length === 0) return null;

  const typeColor: Record<string, string> = {
    PERSON: "#3b82f6",
    PLACE: "#22c55e",
    ORGANIZATION: "#a855f7",
    PHONE: "#f97316",
    VEHICLE: "#eab308",
  };

  return (
    <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <LuUsers style={{ color: "var(--primary)" }} /> Extracted Entities
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--muted-foreground)", fontWeight: 600 }}>Entity</th>
              <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--muted-foreground)", fontWeight: 600 }}>Type</th>
              <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--muted-foreground)", fontWeight: 600 }}>Time</th>
              <th style={{ textAlign: "left", padding: "10px 12px", color: "var(--muted-foreground)", fontWeight: 600 }}>Context</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((ent: any, i: number) => (
              <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 12px", color: "var(--foreground)", fontWeight: 600 }}>
                  {ent.name}
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span style={{
                    padding: "2px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 700,
                    backgroundColor: `${typeColor[ent.type] || "#6b7280"}15`,
                    color: typeColor[ent.type] || "#6b7280",
                  }}>
                    {ent.type || "UNKNOWN"}
                  </span>
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted-foreground)", fontFamily: "monospace", fontSize: "12px" }}>
                  {ent.timestamp || "—"}
                </td>
                <td style={{ padding: "10px 12px", color: "var(--muted-foreground)", maxWidth: "300px" }}>
                  {ent.context}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskKeywords({ intel }: { intel: any }) {
  // Support both new schema (risk_keywords_detected) and old (suspicious_keywords)
  const riskKeywords = intel.risk_keywords_detected;
  const legacyKeywords = intel.suspicious_keywords;

  if ((!riskKeywords || riskKeywords.length === 0) && (!legacyKeywords || legacyKeywords.length === 0)) return null;

  const categoryColor: Record<string, string> = {
    violence: "#ef4444",
    drugs: "#a855f7",
    crime_planning: "#f97316",
    financial: "#eab308",
    code_word: "#6b7280",
  };

  return (
    <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
      <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
        <LuAlertTriangle style={{ color: "#ef4444" }} /> Risk Keywords Detected
      </h3>

      {riskKeywords && riskKeywords.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {riskKeywords.map((kw: any, i: number) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "12px", padding: "8px 14px",
              backgroundColor: "var(--background)", borderRadius: "8px", flexWrap: "wrap",
            }}>
              <span style={{ fontWeight: 700, color: categoryColor[kw.category] || "#ef4444", fontSize: "14px" }}>
                {kw.keyword}
              </span>
              {kw.translation && (
                <span style={{ color: "var(--muted-foreground)", fontSize: "12px" }}>
                  ({kw.translation})
                </span>
              )}
              <span style={{
                padding: "2px 8px", borderRadius: "100px", fontSize: "10px", fontWeight: 700,
                backgroundColor: `${categoryColor[kw.category] || "#6b7280"}15`,
                color: categoryColor[kw.category] || "#6b7280", textTransform: "uppercase",
              }}>
                {kw.category || "flagged"}
              </span>
              {kw.timestamp && (
                <span style={{ color: "var(--muted-foreground)", fontSize: "11px", fontFamily: "monospace" }}>
                  @{kw.timestamp}
                </span>
              )}
              {kw.language && (
                <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>
                  [{kw.language}]
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {legacyKeywords.map((kw: string, i: number) => (
            <span key={i} style={{ padding: "4px 12px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: "100px", fontSize: "13px", fontWeight: 600 }}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionableIntelligence({ intel }: { intel: any }) {
  if (!intel.actionable_intelligence || intel.actionable_intelligence.length === 0) return null;

  return (
    <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
        <LuCircleCheck style={{ color: "#22c55e" }} /> Actionable Intelligence & Directives
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {intel.actionable_intelligence.map((item: string, i: number) => (
          <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", backgroundColor: "var(--background)", padding: "12px 16px", borderRadius: "8px" }}>
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>{i + 1}.</span>
            <span style={{ color: "var(--foreground)", fontSize: "14px", lineHeight: 1.5 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrossReferences({ crossRefs }: { crossRefs: any }) {
  if (!crossRefs || !crossRefs.cross_references || crossRefs.cross_references.length === 0) return null;

  return (
    <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <LuLink style={{ color: "#a855f7" }} /> Cross-Referenced Calls ({crossRefs.cross_references.length})
      </h3>
      <p style={{ color: "var(--muted-foreground)", fontSize: "13px", marginBottom: "16px" }}>
        These calls share common names, locations, or phone numbers with this recording.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {crossRefs.cross_references.map((ref: any) => (
          <Link
            key={ref.call_id}
            href={`/voice-insight/${ref.call_id}`}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "14px 18px", backgroundColor: "var(--background)", borderRadius: "10px",
              border: "1px solid var(--border)", textDecoration: "none",
            }}
          >
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)", marginBottom: "4px" }}>
                {ref.filename || `Case #${ref.call_id.slice(0, 8)}`}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {ref.matching_markers.map((m: any, i: number) => (
                  <span key={i} style={{
                    padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: 600,
                    backgroundColor: "rgba(168, 85, 247, 0.1)", color: "#a855f7",
                  }}>
                    <LuMapPin style={{ fontSize: "10px", verticalAlign: "middle", marginRight: "3px" }} />
                    {m.value}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{
                padding: "4px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: 700,
                backgroundColor: ref.threat_level === "CRITICAL" || ref.threat_level === "HIGH"
                  ? "rgba(239, 68, 68, 0.1)" : "rgba(34, 197, 94, 0.1)",
                color: ref.threat_level === "CRITICAL" || ref.threat_level === "HIGH"
                  ? "#ef4444" : "#22c55e",
              }}>
                {ref.threat_level || "N/A"}
              </span>
              <span style={{ color: "var(--muted-foreground)", fontSize: "12px" }}>
                {ref.match_count} match{ref.match_count > 1 ? "es" : ""}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

function getUtterances(transcript: any): any[] {
  if (!transcript) return [];
  if (Array.isArray(transcript?.result?.transcription?.utterances)) {
    return transcript.result.transcription.utterances;
  }
  if (Array.isArray(transcript?.transcription?.utterances)) {
    return transcript.transcription.utterances;
  }
  if (Array.isArray(transcript?.prediction?.utterances)) {
    return transcript.prediction.utterances;
  }
  if (Array.isArray(transcript?.utterances)) {
    return transcript.utterances;
  }
  return [];
}

function getFullTranscriptText(transcript: any): string {
  if (!transcript) return "";
  if (typeof transcript?.result?.transcription?.full_transcript === "string") {
    return transcript.result.transcription.full_transcript;
  }
  if (typeof transcript?.transcription?.full_transcript === "string") {
    return transcript.transcription.full_transcript;
  }
  if (typeof transcript?.prediction?.transcription === "string") {
    return transcript.prediction.transcription;
  }
  if (typeof transcript === "string") return transcript;
  return "";
}
