import Link from "next/link";
import { LuFileText } from "react-icons/lu";
import styles from "./CallRecordCard.module.css";

interface CallRecord {
  id: string;
  filename?: string;
  status: string;
  created_at: string;
  duration_seconds?: number;
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  completed: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.1)" },
  failed: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" },
  extracting: { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.1)" },
  transcribing: { color: "#eab308", bg: "rgba(234, 179, 8, 0.1)" },
  pending: { color: "#a1a1aa", bg: "rgba(161, 161, 170, 0.1)" },
};

interface CallRecordCardProps {
  call: CallRecord;
}

export function CallRecordCard({ call }: CallRecordCardProps) {
  const statusStyle = STATUS_COLORS[call.status] || STATUS_COLORS.pending;
  const isProcessing = call.status === "transcribing" || call.status === "extracting";

  return (
    <Link href={`/voice-insight/${call.id}`} className={styles.card}>
      <div className={styles.cardLeft}>
        <div className={styles.iconBox}>
          <LuFileText />
        </div>
        <div>
          <div className={styles.cardTitle}>
            {call.filename || `Case #${call.id.slice(0, 8)}`}
          </div>
          <div className={styles.cardMeta}>
            <span>{new Date(call.created_at).toLocaleString()}</span>
            {call.duration_seconds && <span>{Math.round(call.duration_seconds)}s</span>}
          </div>
        </div>
      </div>
      <span
        className={`${styles.statusBadge} ${isProcessing ? styles.statusPulse : ""}`}
        style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
      >
        <span className={styles.statusDot} style={{ backgroundColor: statusStyle.color }} />
        {call.status}
      </span>
    </Link>
  );
}
