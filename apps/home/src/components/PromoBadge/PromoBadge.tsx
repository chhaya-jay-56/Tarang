import styles from "./PromoBadge.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const PromoBadge = () => {
  return (
    <div className={styles.badgeWrapper}>
      {/* Curved Get Started button sitting on top */}
      <a
        href={`${APP_URL}/sign-up`}
        className={styles.getStartedTab}
      >
        <span>Get Started</span>
        <span className={styles.tabArrow} aria-hidden="true">&rarr;</span>
      </a>

      {/* Promo badge container */}
      <div className={styles.promoBadge}>
        {/* Floating sparkle particles */}
        <span className={styles.sparkleOne} />
        <span className={styles.sparkleTwo} />

        {/* Gift icon */}
        <span className={styles.icon}>
          <svg
            className={styles.iconSvg}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 12v10H4V12" />
            <path d="M2 7h20v5H2z" />
            <path d="M12 22V7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        </span>

        <span className={styles.text}>
          Sign up & get{" "}
          <span className={styles.highlight}>5,000 free Credits</span>
        </span>
      </div>
    </div>
  );
};

export default PromoBadge;
