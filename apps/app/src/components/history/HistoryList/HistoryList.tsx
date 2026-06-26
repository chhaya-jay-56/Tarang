"use client";

import { useState, useMemo, useCallback } from "react";
import { LuHistory, LuChevronDown } from "react-icons/lu";
import { Hatch } from "ldrs/react";
import "ldrs/react/Hatch.css";
import { HistoryCard, type HistoryEntry } from "../HistoryCard/HistoryCard";
import styles from "./HistoryList.module.css";

const PAGE_SIZE = 5;

/** Priority order: higher = more relevant (show this over others in the same job). */
const ACTION_PRIORITY: Record<string, number> = {
  clone_completed: 4,
  clone_failed: 3,
  clone_started: 2,
  uploaded: 1,
};

/**
 * Deduplicate entries by `clone_job_id`.
 * For each job keep only the highest-priority action.
 * Entries without a clone_job_id are treated as standalone.
 */
function deduplicateByJob(entries: HistoryEntry[]): HistoryEntry[] {
  const jobMap = new Map<string, HistoryEntry>();
  const standalone: HistoryEntry[] = [];

  for (const entry of entries) {
    if (!entry.clone_job_id) {
      standalone.push(entry);
      continue;
    }

    const existing = jobMap.get(entry.clone_job_id);
    const entryPriority = ACTION_PRIORITY[entry.action] ?? 0;
    const existingPriority = existing ? (ACTION_PRIORITY[existing.action] ?? 0) : -1;

    if (entryPriority > existingPriority) {
      jobMap.set(entry.clone_job_id, entry);
    }
  }

  // Merge & sort by newest first
  const merged = [...jobMap.values(), ...standalone];
  merged.sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });

  return merged;
}

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const dedupedEntries = useMemo(() => deduplicateByJob(entries), [entries]);
  const visibleEntries = useMemo(
    () => dedupedEntries.slice(0, visibleCount),
    [dedupedEntries, visibleCount]
  );
  const hasMore = visibleCount < dedupedEntries.length;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loadingWrapper}>
        <Hatch size="28" stroke="4" speed="3.5" color="currentColor" />
      </div>
    );
  }

  if (error) {
    return <div className={styles.errorBanner}>{error}</div>;
  }

  if (dedupedEntries.length === 0) {
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
      {visibleEntries.map((entry) => (
        <HistoryCard key={entry.id} entry={entry} onDownload={onDownload} />
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={handleLoadMore}
          className={styles.loadMoreBtn}
        >
          <LuChevronDown className={styles.loadMoreIcon} />
          Load More
        </button>
      )}
    </div>
  );
}
