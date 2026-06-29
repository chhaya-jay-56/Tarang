"use client";

import { useState } from "react";
import { LuInfo } from "react-icons/lu";
import styles from "./ScriptBoxInfo.module.css";

/**
 * Tooltip showing punctuation tips for getting richer emotional audio
 * from OmniVoice. Appears on hover below the trigger text.
 */
export function ScriptBoxInfo() {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        <LuInfo className={styles.triggerIcon} />
        Tips for Emotion
      </button>

      {isVisible && (
        <div className={styles.card}>
          <h4 className={styles.cardTitle}>
            🎭 Rich Emotional Audio Tips
          </h4>
          <ul className={styles.tipList}>
            <li className={styles.tipItem}>
              <span className={styles.tipCode}>...</span>
              <span className={styles.tipText}>
                Creates a natural pause or sigh
              </span>
            </li>
            <li className={styles.tipItem}>
              <span className={styles.tipCode}>!!!</span>
              <span className={styles.tipText}>
                Boosts volume and energy for excitement or anger
              </span>
            </li>
            <li className={styles.tipItem}>
              <span className={styles.tipCode}>?!!</span>
              <span className={styles.tipText}>
                Triggers shock or disbelief tone
              </span>
            </li>
            <li className={styles.tipItem}>
              <span className={styles.tipCode}>,</span>
              <span className={styles.tipText}>
                Controls rhythm and storytelling pace
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
