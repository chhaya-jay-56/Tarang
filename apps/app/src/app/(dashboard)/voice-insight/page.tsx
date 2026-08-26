"use client";

import { useEffect, useState, useCallback } from "react";
import { useApiClient } from "@/lib/api";
import { LuSearch } from "react-icons/lu";
import { VoiceInsightHeader } from "@/components/voice-insight/VoiceInsightHeader/VoiceInsightHeader";
import { CallRecordCard } from "@/components/voice-insight/CallRecordCard/CallRecordCard";
import { AnalyticsDashboard } from "@/components/voice-insight/AnalyticsDashboard/AnalyticsDashboard";

export default function VoiceInsightPage() {
  const { authFetch } = useApiClient();
  const [activeTab, setActiveTab] = useState<"records" | "analytics">("records");
  const [calls, setCalls] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchCalls = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = `/api/v1/voice-insight/calls?q=${encodeURIComponent(search)}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      const res = await authFetch(url);
      const data = await res.json();
      setCalls(data.items || []);
    } catch {
      setCalls([]);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, search, statusFilter]);

  useEffect(() => {
    if (activeTab === "records") {
      const timer = setTimeout(fetchCalls, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, fetchCalls]);

  const tabStyle = (active: boolean) => ({
    display: "flex" as const,
    alignItems: "center" as const,
    gap: "8px",
    padding: "8px 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer" as const,
    border: "none" as const,
    background: active ? "var(--card)" : "transparent",
    color: active ? "var(--foreground)" : "var(--muted-foreground)",
    boxShadow: active ? "0 1px 6px rgba(0, 0, 0, 0.12)" : "none",
    transition: "all 0.2s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1050px", width: "100%", padding: "0 16px", margin: "0 auto", paddingBottom: "40px" }}>
      <VoiceInsightHeader />

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
        <button onClick={() => setActiveTab("records")} style={tabStyle(activeTab === "records")}>
          Call Records
        </button>
        <button onClick={() => setActiveTab("analytics")} style={tabStyle(activeTab === "analytics")}>
          Analytics
        </button>
      </div>

      {activeTab === "records" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Filters */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", position: "relative", flex: 1, minWidth: "240px" }}>
              <LuSearch style={{ position: "absolute", left: "14px", top: "12px", color: "var(--muted-foreground)" }} />
              <input
                type="text"
                placeholder="Search by filename..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "10px 14px 10px 40px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--foreground)", fontSize: "13px", outline: "none" }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "10px 14px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--foreground)", fontSize: "13px", outline: "none" }}
            >
              <option value="">All Statuses</option>
              <option value="transcribing">Transcribing</option>
              <option value="extracting">Extracting</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {isLoading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)", background: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}>
                Loading case records...
              </div>
            ) : calls.length === 0 ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--muted-foreground)", background: "var(--card)", borderRadius: "12px", border: "1px solid var(--border)" }}>
                No intelligence records found. Submit a new call recording above.
              </div>
            ) : (
              calls.map((call) => <CallRecordCard key={call.id} call={call} />)
            )}
          </div>
        </div>
      )}

      {activeTab === "analytics" && <AnalyticsDashboard authFetch={authFetch} />}
    </div>
  );
}
