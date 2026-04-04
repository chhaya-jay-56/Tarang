"use client";

import ShinyText from "@/components/ShinyText/ShinyText";
import styles from "./Header.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={`${styles.brand} fade-in-up`} style={{ animationDelay: '0.1s' }}>
        <div className={styles.logoContainer}>
          <ShinyText text="Tarang" disabled={false} speed={3} className={styles.brandName} />
        </div>
        <div className={styles.betaLogoContainer}>
          <span className={styles.betaIcon}>β</span>
          <span className={styles.betaTooltip}>Beta Version</span>
        </div>
      </div>

      <div className={`${styles.headerRight} fade-in-up`} style={{ animationDelay: '0.3s' }}>
        <a href={APP_URL} className={styles.ctaButton}>Get Started Now &rarr;</a>
      </div>
    </header>
  );
};

export default Header;
