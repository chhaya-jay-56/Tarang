"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useCredits } from "@/hooks/useCredits";
import styles from "./CreditBar.module.css";

/**
 * Credit pill in the TopBar. Shows remaining credits + plan badge.
 * Clicks to expand a usage panel with upgrade/buy CTAs.
 */
export function CreditBar() {
  const { credits, planType, totalCredits, isLoading } = useCredits();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const effectiveTotal = Math.max(totalCredits, credits);
  const percentage = effectiveTotal > 0
    ? Math.min((credits / effectiveTotal) * 100, 100)
    : 0;

  const formattedCredits = credits.toLocaleString("en-US");
  const formattedTotal = totalCredits.toLocaleString("en-US");

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (isLoading) {
    return (
      <div className={styles.pillSkeleton}>
        <div className={styles.skeletonShimmer} />
      </div>
    );
  }

  return (
    <div className={styles.wrapper} ref={panelRef}>
      {/* ── Collapsed Pill ── */}
      <button
        className={styles.pill}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label="Credit balance"
        id="credit-bar-pill"
      >
        <span className={styles.creditIcon}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v12M6 12h12" />
          </svg>
        </span>
        <span className={styles.creditAmount}>{formattedCredits}</span>
        <div className={styles.miniBar}>
          <div
            className={styles.miniBarFill}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </button>

      {/* ── Expanded Panel ── */}
      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Credit Usage</span>
          </div>

          {/* Usage bar */}
          <div className={styles.usageSection}>
            <div className={styles.usageNumbers}>
              <span className={styles.usageCurrent}>{formattedCredits}</span>
              <span className={styles.usageSeparator}>/</span>
              <span className={styles.usageTotal}>{formattedTotal}</span>
            </div>
            <div className={styles.usageBar}>
              <div
                className={styles.usageBarFill}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className={styles.usageLabel}>credits remaining this month</span>
          </div>

          {/* CTAs */}
          <div className={styles.panelActions}>
            {/* Payment implementation incoming, 'Get More Credits' removed */}
          </div>
        </div>
      )}
    </div>
  );
}
