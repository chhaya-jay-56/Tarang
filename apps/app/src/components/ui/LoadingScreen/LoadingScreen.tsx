"use client";

import { Hatch } from "ldrs/react";
import "ldrs/react/Hatch.css";
import styles from "./LoadingScreen.module.css";

/**
 * Full-screen loading overlay used during auth transitions
 * (login, logout, background tab return).
 *
 * Uses the same Hatch animation as HistoryList, ProcessingStepper, etc.
 */
export function LoadingScreen() {
  return (
    <div className={styles.overlay}>
      <span className={styles.brandText}>Tarang</span>
      <div className={styles.loaderWrapper}>
        <Hatch size="28" stroke="4" speed="3.5" color="currentColor" />
      </div>
    </div>
  );
}
