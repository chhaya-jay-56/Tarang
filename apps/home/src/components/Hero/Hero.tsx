"use client";

import AnimatedTagline from "@/components/AnimatedTagline/AnimatedTagline";
import PromoBadge from "@/components/PromoBadge/PromoBadge";
import styles from "./Hero.module.css";

const Hero = () => {
  return (
    <main className={styles.hero}>
      <div className={styles.heroContent}>
        <PromoBadge />

        <h1 className={`${styles.heroTitle} fade-in-up`} style={{ animationDelay: '0.2s' }}>
          <span className={styles.gradientText}>Voice</span>
          <span className={styles.arrow}>&gt;</span>
          <span className={styles.gradientText}>Text</span>
          <span className={styles.srOnly}> — AI Voice Cloning in 100+ Languages</span>
        </h1>
        <AnimatedTagline
          text="Bring real emotion to your voice, without losing the context."
          startDelay={0.6}
          stagger={0.08}
        />
        <div className={`${styles.ctaWrapper} fade-in-up`} style={{ animationDelay: '1.2s' }}>
          <a
            href="https://youtu.be/UwLwq9Vnzdk"
            className={styles.demoButton}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.playIcon} aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M7.5 5.8L14 10l-6.5 4.2V5.8Z" fill="currentColor" />
              </svg>
            </span>
            Watch the demo
            <span className={styles.buttonArrow} aria-hidden="true">{"\u2197"}</span>
          </a>
          <a href="/examples" className={styles.examplesButton}>
            See examples
            <span className={styles.buttonArrow} aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </main>
  );
};

export default Hero;
