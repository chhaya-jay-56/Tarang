"use client";

import { useEffect, useState, useCallback } from "react";
import { useApiClient } from "@/lib/api";
import Link from "next/link";
import { 
  LuUpload, 
  LuShield, 
  LuSearch, 
  LuActivity, 
  LuList, 
  LuShieldAlert, 
  LuClock, 
  LuFlame, 
  LuTag, 
  LuGlobe,
  LuFileText
} from "react-icons/lu";

export default function VoiceInsightPage() {
  const { authFetch } = useApiClient();
  const [activeTab, setActiveTab] = useState<"records" | "analytics">("records");

  // Records state
  const [calls, setCalls] = useState<any[]>([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Analytics state
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  const fetchCalls = useCallback(async () => {
    setIsLoadingCalls(true);
    try {
      let url = `/api/v1/voice-insight/calls?q=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await authFetch(url);
      const data = await res.json();
      setCalls(data.items || []);
    } catch (err) {
      console.error("Failed to fetch call records:", err);
      setCalls([]);
    } finally {
      setIsLoadingCalls(false);
    }
  }, [authFetch, search, statusFilter]);

  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await authFetch("/api/v1/voice-insight/analytics?days=30");
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (activeTab === "records") {
      const timer = setTimeout(() => {
        fetchCalls();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      fetchAnalytics();
    }
  }, [activeTab, fetchCalls, fetchAnalytics]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px", maxWidth: "1050px", width: "100%", padding: "0 16px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--foreground)", letterSpacing: "0.01em", display: "flex", alignItems: "center", gap: "10px" }}>
            <LuShield style={{ color: "var(--primary)" }} /> VoiceInsight Intelligence
          </h1>
          <p style={{ color: "var(--muted-foreground)", fontSize: "14px" }}>
            Ahmedabad Police Automated Multilingual Call Recording Transcription & Threat Extraction
          </p>
        </div>
        <Link href="/voice-insight/upload" style={{
            display: "flex", alignItems: "center", gap: "8px", 
            backgroundColor: "var(--primary)", color: "var(--primary-foreground)", 
            padding: "10px 18px", borderRadius: "10px", fontSize: "14px", fontWeight: 600,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)", textDecoration: "none"
          }}>
          <LuUpload /> New Analysis
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
        <button
          onClick={() => setActiveTab("records")}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px",
            fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none",
            backgroundColor: activeTab === "records" ? "var(--card)" : "transparent",
            color: activeTab === "records" ? "var(--primary)" : "var(--muted-foreground)",
            boxShadow: activeTab === "records" ? "0 1px 4px rgba(0,0,0,0.1)" : "none"
          }}
        >
          <LuList /> Call Records
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px",
            fontSize: "14px", fontWeight: 600, cursor: "pointer", border: "none",
            backgroundColor: activeTab === "analytics" ? "var(--card)" : "transparent",
            color: activeTab === "analytics" ? "var(--primary)" : "var(--muted-foreground)",
            boxShadow: activeTab === "analytics" ? "0 1px 4px rgba(0,0,0,0.1)" : "none"
          }}
        >
          <LuActivity /> Analytics & Heatmap
        </button>
      </div>

      {/* Tab Content 1: Records */}
      {activeTab === "records" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", position: "relative", flex: 1, minWidth: "260px" }}>
              <LuSearch style={{ position: "absolute", left: "14px", top: "12px", color: "var(--muted-foreground)" }} />
              <input 
                type="text" 
                placeholder="Search by case ID or filename..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ 
                  width: "100%", padding: "10px 14px 10px 40px", 
                  backgroundColor: "var(--card)", border: "1px solid var(--border)", 
                  borderRadius: "10px", color: "var(--foreground)", fontSize: "14px", outline: "none"
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "10px 14px", backgroundColor: "var(--card)", border: "1px solid var(--border)",
                borderRadius: "10px", color: "var(--foreground)", fontSize: "14px", outline: "none"
              }}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="transcribing">Transcribing (Gladia)</option>
              <option value="extracting">Extracting (Qwen)</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {isLoadingCalls ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)", backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}>
                Loading case records...
              </div>
            ) : calls.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)", backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}>
                No intelligence records found. Submit a new call recording above.
              </div>
            ) : (
              calls.map((call) => {
                const statusColor = 
                  call.status === "completed" ? "#22c55e" :
                  call.status === "failed" ? "#ef4444" :
                  call.status === "extracting" ? "#3b82f6" : "#eab308";

                return (
                  <Link key={call.id} href={`/voice-insight/${call.id}`} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "18px 20px", backgroundColor: "var(--card)", border: "1px solid var(--border)",
                    borderRadius: "12px", textDecoration: "none", transition: "all 0.2s"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ 
                        width: "42px", height: "42px", borderRadius: "10px", 
                        backgroundColor: "var(--background)", display: "flex", alignItems: "center", 
                        justifyContent: "center", color: "var(--primary)", border: "1px solid var(--border)" 
                      }}>
                        <LuFileText style={{ fontSize: "20px" }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", marginBottom: "4px" }}>
                          {call.filename || "Case #" + call.id.slice(0, 8)}
                        </h3>
                        <p style={{ fontSize: "13px", color: "var(--muted-foreground)", display: "flex", alignItems: "center", gap: "8px" }}>
                          <span>{new Date(call.created_at).toLocaleString()}</span>
                          {call.duration_seconds && <span>• {Math.round(call.duration_seconds)}s</span>}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ 
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "4px 12px", backgroundColor: `rgba(${statusColor === "#22c55e" ? "34, 197, 94" : statusColor === "#ef4444" ? "239, 68, 68" : "59, 130, 246"}, 0.1)`, 
                        color: statusColor, borderRadius: "100px", fontSize: "12px", fontWeight: 600 
                      }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: statusColor }} />
                        {call.status}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab Content 2: Analytics & Heatmap */}
      {activeTab === "analytics" && (
        <div>
          {isLoadingAnalytics ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)", backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}>
              Computing intelligence analytics & emotion heatmaps...
            </div>
          ) : !analytics ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)", backgroundColor: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}>
              Failed to load analytics data.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Metric Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500 }}>
                    <LuFileText /> Total Calls Processed
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--foreground)" }}>
                    {analytics.total_calls}
                  </div>
                </div>

                <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500 }}>
                    <LuClock /> Total Audio Analyzed
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: "var(--foreground)" }}>
                    {analytics.total_duration_minutes} mins
                  </div>
                </div>

                <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "#ef4444", fontSize: "13px", fontWeight: 500 }}>
                    <LuShieldAlert /> Critical Threat Alerts
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: "#ef4444" }}>
                    {analytics.threat_distribution?.CRITICAL || 0}
                  </div>
                </div>

                <div style={{ backgroundColor: "var(--card)", padding: "20px", borderRadius: "12px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", color: "var(--muted-foreground)", fontSize: "13px", fontWeight: 500 }}>
                    <LuGlobe /> Primary Languages
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--foreground)" }}>
                    {Object.keys(analytics.language_distribution || {}).join(", ") || "Hindi, Gujarati, English"}
                  </div>
                </div>
              </div>

              {/* Threat Distribution & Emotion Heatmap */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "20px" }}>
                {/* Threat Distribution */}
                <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <LuShieldAlert style={{ color: "#ef4444" }} /> Threat Level Breakdown
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {[
                      { label: "CRITICAL", count: analytics.threat_distribution?.CRITICAL || 0, color: "#ef4444" },
                      { label: "HIGH", count: analytics.threat_distribution?.HIGH || 0, color: "#f97316" },
                      { label: "MEDIUM", count: analytics.threat_distribution?.MEDIUM || 0, color: "#eab308" },
                      { label: "LOW", count: analytics.threat_distribution?.LOW || 0, color: "#22c55e" },
                    ].map((item) => {
                      const total = analytics.total_calls || 1;
                      const pct = Math.round((item.count / total) * 100);
                      return (
                        <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600 }}>
                            <span style={{ color: item.color }}>{item.label}</span>
                            <span style={{ color: "var(--muted-foreground)" }}>{item.count} calls ({pct}%)</span>
                          </div>
                          <div style={{ width: "100%", height: "8px", backgroundColor: "var(--background)", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", backgroundColor: item.color, borderRadius: "4px", transition: "width 0.5s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Emotion Heatmap */}
                <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "center", gap: "8px" }}>
                    <LuFlame style={{ color: "#f97316" }} /> Emotion & Stress Heatmap
                  </h3>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {[
                      { label: "Anger", val: (analytics.emotion_heatmap?.anger || 0) * 100, color: "#ef4444" },
                      { label: "Urgency", val: (analytics.emotion_heatmap?.urgency || 0) * 100, color: "#f97316" },
                      { label: "Stress", val: (analytics.emotion_heatmap?.stress || 0) * 100, color: "#eab308" },
                      { label: "Calmness", val: (analytics.emotion_heatmap?.calm || 0) * 100, color: "#22c55e" },
                    ].map((item) => (
                      <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600 }}>
                          <span style={{ color: "var(--foreground)" }}>{item.label}</span>
                          <span style={{ color: item.color }}>{Math.round(item.val)}%</span>
                        </div>
                        <div style={{ width: "100%", height: "8px", backgroundColor: "var(--background)", borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: `${item.val}%`, height: "100%", backgroundColor: item.color, borderRadius: "4px", transition: "width 0.5s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Flagged Keywords Cloud */}
              <div style={{ backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "16px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: 600, color: "var(--foreground)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <LuTag style={{ color: "var(--primary)" }} /> Frequently Flagged Intelligence Keywords
                </h3>

                {analytics.top_keywords && analytics.top_keywords.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                    {analytics.top_keywords.map((kw: any, i: number) => (
                      <span key={i} style={{ 
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "6px 14px", backgroundColor: "rgba(239, 68, 68, 0.1)", 
                        color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.2)",
                        borderRadius: "100px", fontSize: "13px", fontWeight: 600 
                      }}>
                        {kw.keyword}
                        <span style={{ backgroundColor: "#ef4444", color: "#fff", padding: "1px 6px", borderRadius: "10px", fontSize: "11px" }}>
                          {kw.count}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "var(--muted-foreground)", fontSize: "14px" }}>No suspicious keywords flagged in this period.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
