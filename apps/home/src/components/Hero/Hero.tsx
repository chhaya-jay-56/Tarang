"use client";

import AnimatedTagline from "@/components/AnimatedTagline/AnimatedTagline";
import styles from "./Hero.module.css";

const Hero = () => {
  return (
    <main className={styles.hero}>
      <div className={styles.heroContent}>
        <h1 className={`${styles.heroTitle} fade-in-up`} style={{ animationDelay: '0.2s' }}>
          <span className={styles.gradientText}>Voice</span>
          <span className={styles.arrow}>&gt;</span>
          <span className={styles.gradientText}>Text</span>
        </h1>
        <AnimatedTagline
          text="Bring real emotion to your voice, without losing the context."
          startDelay={0.6}
          stagger={0.08}
        />
      </div>
    </main>
  );
};

export default Hero;
