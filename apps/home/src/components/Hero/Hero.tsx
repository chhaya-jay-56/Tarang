"use client";

import styles from "./Hero.module.css";

const Hero = () => {
  const tagline = "Dub > Sub"
  return (
    <main className={styles.hero}>
      <div className={styles.heroContent}>
        <h1
          className={`${styles.heroTitle} fade-in-up`}
          style={{ animationDelay: '0.2s' }}
        >
          <span className="decrypted-text-wrapper">
            {tagline}
          </span>
        </h1>
        <p className={`${styles.heroTagline} fade-in-up`} style={{ animationDelay: '0.5s' }}>
          Bring real emotion to your voice and your favorite shows, without losing the context.
        </p>
      </div>
    </main>
  );
};

export default Hero;
