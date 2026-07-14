"use client";

import AnimatedTagline from "@/components/AnimatedTagline/AnimatedTagline";
import styles from "./Hero.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const Hero = () => {
  return (
    <main className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={`${styles.mobileSparkleBadge} fade-in-up`} style={{ animationDelay: '0.1s' }}>
          ✨ Clone once. Speak Forever
        </div>
        <h1 className={`${styles.heroTitle} fade-in-up`} style={{ animationDelay: '0.2s' }}>
          <span className={styles.gradientText}>Voice</span>
          <span className={styles.arrow}>&gt;</span>
          <span className={styles.gradientText}>Text</span>
          <span className={styles.srOnly}> — AI Voice Cloning in 500+ Languages</span>
        </h1>
        <AnimatedTagline
          text="Bring real emotion to your voice, without losing the context."
          startDelay={0.6}
          stagger={0.08}
        />
        <div className={`${styles.ctaWrapper} fade-in-up`} style={{ animationDelay: '1.2s' }}>
          <a href={APP_URL} className={styles.ctaButton}>
            Get Started &rarr;
          </a>
        </div>
      </div>
    </main>
  );
};

export default Hero;
