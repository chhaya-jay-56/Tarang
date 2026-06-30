"use client";

import dynamic from "next/dynamic";
import styles from "./Hero.module.css";

const Hero = () => {
  const tagline = "Voice > Text"
  return (
    <main className={styles.hero}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, overflow: 'hidden' }}>
        
      </div>
      <div className={styles.heroContent} style={{ position: 'relative', zIndex: 1 }}>
        <h1
          className={`${styles.heroTitle} fade-in-up`}
          style={{ animationDelay: '0.2s' }}
        >
          <span className="decrypted-text-wrapper">
            {tagline}
          </span>
        </h1>
        <p className={`${styles.heroTagline} fade-in-up`} style={{ animationDelay: '0.5s' }}>
          Bring real emotion to your voice, without losing the context.
        </p>
      </div>
    </main>
  );
};

export default Hero;
