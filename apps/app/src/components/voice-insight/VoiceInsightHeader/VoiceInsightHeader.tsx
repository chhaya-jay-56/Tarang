import Link from "next/link";
import { LuShield, LuUpload } from "react-icons/lu";
import styles from "./VoiceInsightHeader.module.css";

export function VoiceInsightHeader() {
  return (
    <div className={styles.header}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>
          <LuShield className={styles.titleIcon} />
          VoiceInsight Intelligence
        </h1>
        <p className={styles.subtitle}>
          Automated Multilingual Call Recording Transcription and Threat Extraction
        </p>
      </div>
      <Link href="/voice-insight/upload" className={styles.newAnalysisBtn}>
        <LuUpload /> New Analysis
      </Link>
    </div>
  );
}
