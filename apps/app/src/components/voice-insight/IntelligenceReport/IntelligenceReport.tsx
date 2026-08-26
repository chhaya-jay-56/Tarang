import {
  LuShieldAlert,
  LuMessageSquare,
  LuFileAudio,
  LuFileText,
  LuClock,
  LuUsers,
  LuTriangleAlert,
  LuCircleCheck,
} from "react-icons/lu";
import styles from "./IntelligenceReport.module.css";

interface IntelligenceReportProps {
  intelligence: Record<string, any>;
}

const THREAT_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  PERSON: "#3b82f6",
  PLACE: "#22c55e",
  ORGANIZATION: "#a855f7",
  PHONE: "#f97316",
  VEHICLE: "#eab308",
};

const CATEGORY_COLORS: Record<string, string> = {
  violence: "#ef4444",
  drugs: "#a855f7",
  crime_planning: "#f97316",
  financial: "#eab308",
  code_word: "#6b7280",
};

export function IntelligenceReport({ intelligence }: IntelligenceReportProps) {
  const intel = intelligence;
  const threatColor = THREAT_COLORS[intel.threat_level] || "#22c55e";

  return (
    <>
      <MetricCards intel={intel} threatColor={threatColor} />
      <WholeCallSummary intel={intel} />
      <TimestampedSummary intel={intel} />
      <EntityTable intel={intel} />
      <RiskKeywords intel={intel} />
      <ActionableIntelligence intel={intel} />
    </>
  );
}

/* -- Sub-components -- */

function MetricCards({ intel, threatColor }: { intel: any; threatColor: string }) {
  return (
    <div className={styles.metricsGrid}>
      <div className={styles.metricCard}>
        <div className={styles.metricLabel}>
          <LuShieldAlert /> Threat Assessment
        </div>
        <div className={styles.threatBadge} style={{ color: threatColor }}>
          <span className={styles.threatDot} style={{ backgroundColor: threatColor }} />
          {intel.threat_level || "UNKNOWN"}
        </div>
      </div>
      <div className={styles.metricCard}>
        <div className={styles.metricLabel}>
          <LuMessageSquare /> Primary Language
        </div>
        <div className={styles.metricValue}>
          {intel.primary_language || "Multilingual"}
        </div>
      </div>
      <div className={styles.metricCard}>
        <div className={styles.metricLabel}>
          <LuFileAudio /> Overall Sentiment
        </div>
        <div className={styles.metricValue}>
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
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <LuFileText className={styles.sectionIcon} />
        Whole-Call Summary
      </h3>
      <p className={styles.summaryText}>{summary}</p>
    </div>
  );
}

function TimestampedSummary({ intel }: { intel: any }) {
  const events = intel.timestamped_summary;
  if (!events || !Array.isArray(events) || events.length === 0) return null;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <LuClock className={styles.sectionIcon} />
        Timestamped Summary
      </h3>
      <div className={styles.timeline}>
        <div className={styles.timelineLine} />
        {events.map((evt: any, i: number) => (
          <div key={i} className={styles.timelineItem}>
            <span className={styles.timelineTs}>{evt.timestamp || "--"}</span>
            <div className={styles.timelineDot} />
            <span className={styles.timelineText}>{evt.event}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EntityTable({ intel }: { intel: any }) {
  const entities = intel.entity_table;
  if (!entities || !Array.isArray(entities) || entities.length === 0) return null;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <LuUsers className={styles.sectionIcon} />
        Extracted Entities
      </h3>
      <div style={{ overflowX: "auto" }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Entity</th>
              <th>Type</th>
              <th>Time</th>
              <th>Context</th>
            </tr>
          </thead>
          <tbody>
            {entities.map((ent: any, i: number) => {
              const typeColor = ENTITY_TYPE_COLORS[ent.type] || "#6b7280";
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: "var(--foreground)" }}>{ent.name}</td>
                  <td>
                    <span
                      className={styles.entityTypeBadge}
                      style={{
                        backgroundColor: `${typeColor}15`,
                        color: typeColor,
                      }}
                    >
                      {ent.type || "UNKNOWN"}
                    </span>
                  </td>
                  <td className={styles.keywordMeta}>{ent.timestamp || "--"}</td>
                  <td className={styles.entityContext}>{ent.context}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskKeywords({ intel }: { intel: any }) {
  const riskKeywords = intel.risk_keywords_detected;
  const legacyKeywords = intel.suspicious_keywords;
  if (
    (!riskKeywords || riskKeywords.length === 0) &&
    (!legacyKeywords || legacyKeywords.length === 0)
  )
    return null;

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <LuTriangleAlert className={styles.sectionIcon} style={{ color: "#ef4444" }} />
        Risk Keywords Detected
      </h3>
      {riskKeywords && riskKeywords.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {riskKeywords.map((kw: any, i: number) => {
            const catColor = CATEGORY_COLORS[kw.category] || "#ef4444";
            return (
              <div key={i} className={styles.keywordRow}>
                <span className={styles.keywordName} style={{ color: catColor }}>
                  {kw.keyword}
                </span>
                {kw.translation && (
                  <span className={styles.keywordTranslation}>({kw.translation})</span>
                )}
                <span
                  className={styles.keywordCategoryBadge}
                  style={{ backgroundColor: `${catColor}15`, color: catColor }}
                >
                  {kw.category || "flagged"}
                </span>
                {kw.timestamp && <span className={styles.keywordMeta}>@{kw.timestamp}</span>}
                {kw.language && <span className={styles.keywordMeta}>[{kw.language}]</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {legacyKeywords.map((kw: string, i: number) => (
            <span
              key={i}
              className={styles.keywordCategoryBadge}
              style={{ backgroundColor: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "4px 12px", fontSize: "13px" }}
            >
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
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>
        <LuCircleCheck className={styles.sectionIcon} style={{ color: "#22c55e" }} />
        Actionable Intelligence
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {intel.actionable_intelligence.map((item: string, i: number) => (
          <div key={i} className={styles.actionItem}>
            <span className={styles.actionNumber}>{i + 1}.</span>
            <span className={styles.actionText}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
