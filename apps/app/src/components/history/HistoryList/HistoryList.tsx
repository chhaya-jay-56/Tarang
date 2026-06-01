"use client";

import { LuHistory, LuLoader } from "react-icons/lu";
import { HistoryCard, type HistoryEntry } from "../HistoryCard/HistoryCard";
import styles from "./HistoryList.module.css";

interface HistoryListProps {
  entries: HistoryEntry[];
  isLoading: boolean;
  error: string | null;
  onDownload: (url: string, filename?: string) => void;
}

export function HistoryList({
  entries,
  isLoading,
  error,
  onDownload,
}: HistoryListProps) {
  if (isLoading) {
    return (
      <div className={styles.loadingWrapper}>
        <LuLoader className={styles.spinner} />
      </div>
    );
  }

  if (error) {
    return <div className={styles.errorBanner}>{error}</div>;
  }

  if (entries.length === 0) {
    return (
      <div className={styles.emptyWrapper}>
        <div className={styles.emptyIconCircle}>
          <LuHistory className={styles.emptyIcon} />
        </div>
        <h3 className={styles.emptyTitle}>No past generations</h3>
        <p className={styles.emptySubtitle}>
          You haven&apos;t generated any cloned voices yet. Your past
          generations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {entries.map((entry) => (
        <HistoryCard key={entry.id} entry={entry} onDownload={onDownload} />
      ))}
    </div>
  );
}
