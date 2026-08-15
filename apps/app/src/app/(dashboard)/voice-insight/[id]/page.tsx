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
  LuCircleCheck
} from "react-icons/lu";
import Link from "next/link";

export default function VoiceInsightDetail() {
  const { id } = useParams();
  const { authFetch } = useApiClient();
  const [call, setCall] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

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

  useEffect(() => {
    if (id) {
      fetchCall();
    }
  }, [fetchCall, id]);

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

          {/* Export Dropdown / Actions */}
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500 }}>
                <LuShieldAlert /> Threat Assessment
              </div>
              <div style={{ fontSize: "24px", fontWeight: 800, color: threatColor, display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: threatColor }} />
                {call.intelligence.threat_level || "UNKNOWN"}
              </div>
            </div>

            <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500 }}>
                <LuMessageSquare /> Primary Language
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--foreground)" }}>
                {call.intelligence.primary_language || "Multilingual"}
              </div>
            </div>

            <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500 }}>
                <LuFileAudio /> Overall Sentiment
              </div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--foreground)" }}>
                {call.intelligence.overall_sentiment || "Neutral"}
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
              <LuFileText style={{ color: "var(--primary)" }} /> Executive Summary
            </h3>
            <p style={{ color: "var(--foreground)", fontSize: "15px", lineHeight: 1.7 }}>
              {call.intelligence.summary}
            </p>
          </div>

          {/* Actionable Intelligence */}
          {call.intelligence.actionable_intelligence && call.intelligence.actionable_intelligence.length > 0 && (
            <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
              <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                <LuCircleCheck style={{ color: "#22c55e" }} /> Actionable Intelligence & Directives
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {call.intelligence.actionable_intelligence.map((item: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start", backgroundColor: "var(--background)", padding: "12px 16px", borderRadius: "8px" }}>
                    <span style={{ color: "var(--primary)", fontWeight: 700 }}>{i + 1}.</span>
                    <span style={{ color: "var(--foreground)", fontSize: "14px", lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suspicious Keywords & Named Entities */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
            {call.intelligence.suspicious_keywords && call.intelligence.suspicious_keywords.length > 0 && (
              <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <LuTag style={{ color: "#ef4444" }} /> Flagged Keywords
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {call.intelligence.suspicious_keywords.map((kw: string, i: number) => (
                    <span key={i} style={{ padding: "4px 12px", backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", borderRadius: "100px", fontSize: "13px", fontWeight: 600 }}>
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {call.intelligence.named_entities && call.intelligence.named_entities.length > 0 && (
              <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <LuMessageSquare style={{ color: "var(--primary)" }} /> Named Entities / Locations
                </h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {call.intelligence.named_entities.map((ne: string, i: number) => (
                    <span key={i} style={{ padding: "4px 12px", backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", borderRadius: "100px", fontSize: "13px", fontWeight: 600 }}>
                      {ne}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
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
          {call.transcript?.prediction?.utterances ? (
            call.transcript.prediction.utterances.map((utt: any, idx: number) => (
              <div key={idx} style={{ marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <strong style={{ color: "var(--primary)", fontSize: "13px" }}>Speaker {utt.speaker || 'Unknown'}</strong>
                  <span style={{ color: "var(--muted-foreground)", fontSize: "11px" }}>
                    [{Math.floor(utt.start || 0)}s - {Math.floor(utt.end || 0)}s]
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "14px", color: "var(--foreground)" }}>{utt.text}</p>
              </div>
            ))
          ) : call.transcript?.prediction?.transcription ? (
            <p>{call.transcript.prediction.transcription}</p>
          ) : (
            <p style={{ color: "var(--muted-foreground)" }}>Transcript will be available once transcribing completes.</p>
          )}
        </div>
      </div>
    </div>
  );
}
