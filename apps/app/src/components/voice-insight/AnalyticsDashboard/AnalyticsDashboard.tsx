import { useEffect, useState, useCallback } from "react";
import {
  LuFileText,
  LuClock,
  LuShieldAlert,
  LuGlobe,
  LuFlame,
  LuTag,
} from "react-icons/lu";
import styles from "./AnalyticsDashboard.module.css";

interface AnalyticsDashboardProps {
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export function AnalyticsDashboard({ authFetch }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch("/api/v1/voice-insight/analytics?days=30");
      setAnalytics(await res.json());
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (isLoading) {
    return <div className={styles.loadingBox}>Computing intelligence analytics...</div>;
  }
  if (!analytics) {
    return <div className={styles.loadingBox}>Failed to load analytics data.</div>;
  }

  const threatBars = [
    { label: "CRITICAL", count: analytics.threat_distribution?.CRITICAL || 0, color: "#ef4444" },
    { label: "HIGH", count: analytics.threat_distribution?.HIGH || 0, color: "#f97316" },
    { label: "MEDIUM", count: analytics.threat_distribution?.MEDIUM || 0, color: "#eab308" },
    { label: "LOW", count: analytics.threat_distribution?.LOW || 0, color: "#22c55e" },
  ];

  const emotionBars = [
    { label: "Anger", val: (analytics.emotion_heatmap?.anger || 0) * 100, color: "#ef4444" },
    { label: "Urgency", val: (analytics.emotion_heatmap?.urgency || 0) * 100, color: "#f97316" },
    { label: "Stress", val: (analytics.emotion_heatmap?.stress || 0) * 100, color: "#eab308" },
    { label: "Calmness", val: (analytics.emotion_heatmap?.calm || 0) * 100, color: "#22c55e" },
  ];

  const total = analytics.total_calls || 1;

  return (
    <div className={styles.container}>
      {/* Metric Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}><LuFileText /> Total Calls</div>
          <div className={styles.metricValue}>{analytics.total_calls}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}><LuClock /> Audio Analyzed</div>
          <div className={styles.metricValue}>{analytics.total_duration_minutes} min</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel} style={{ color: "#ef4444" }}><LuShieldAlert /> Critical Alerts</div>
          <div className={styles.metricValue} style={{ color: "#ef4444" }}>{analytics.threat_distribution?.CRITICAL || 0}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}><LuGlobe /> Languages</div>
          <div className={styles.metricValue} style={{ fontSize: "16px" }}>
            {Object.keys(analytics.language_distribution || {}).join(", ") || "N/A"}
          </div>
        </div>
      </div>

      {/* Threat + Emotion */}
      <div className={styles.twoColGrid}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <LuShieldAlert style={{ color: "#ef4444" }} /> Threat Level Breakdown
          </h3>
          <div className={styles.barGroup}>
            {threatBars.map((item) => {
              const pct = Math.round((item.count / total) * 100);
              return (
                <div key={item.label} className={styles.barRow}>
                  <div className={styles.barMeta}>
                    <span style={{ color: item.color }}>{item.label}</span>
                    <span style={{ color: "var(--muted-foreground)" }}>{item.count} ({pct}%)</span>
                  </div>
                  <div className={styles.barTrack}>
                    <div className={styles.barFill} style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            <LuFlame style={{ color: "#f97316" }} /> Emotion Heatmap
          </h3>
          <div className={styles.barGroup}>
            {emotionBars.map((item) => (
              <div key={item.label} className={styles.barRow}>
                <div className={styles.barMeta}>
                  <span style={{ color: "var(--foreground)" }}>{item.label}</span>
                  <span style={{ color: item.color }}>{Math.round(item.val)}%</span>
                </div>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${item.val}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Keywords */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>
          <LuTag style={{ color: "#38bdf8" }} /> Flagged Intelligence Keywords
        </h3>
        {analytics.top_keywords && analytics.top_keywords.length > 0 ? (
          <div className={styles.keywordCloud}>
            {analytics.top_keywords.map((kw: any, i: number) => (
              <span key={i} className={styles.keywordBadge}>
                {kw.keyword}
                <span className={styles.keywordCount}>{kw.count}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className={styles.emptyState}>No suspicious keywords flagged in this period.</p>
        )}
      </div>
    </div>
  );
}
