"use client";

import { useMemo } from "react";
import styles from "./AnimatedTagline.module.css";

interface AnimatedTaglineProps {
  text: string;
  /** Delay in seconds before the animation starts */
  startDelay?: number;
  /** Stagger delay between each word in seconds */
  stagger?: number;
}

const AnimatedTagline = ({
  text,
  startDelay = 0.8,
  stagger = 0.08,
}: AnimatedTaglineProps) => {
  const words = useMemo(() => text.split(" "), [text]);

  return (
    <p className={styles.tagline}>
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          className={styles.word}
          style={{
            animationDelay: `${startDelay + i * stagger}s`,
          }}
        >
          {word}
        </span>
      ))}
    </p>
  );
};

export default AnimatedTagline;
