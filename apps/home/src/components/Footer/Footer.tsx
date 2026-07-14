"use client";

import Image from "next/image";
import styles from "./Footer.module.css";

const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      "Text to Speech",
      "Voice Cloning",
      "Voice Separation",
      "Voice Library",
      "Voice Creation",
    ],
  },
];

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <div className={styles.logoContainer}>
              <Image 
                src="/Logo.svg" 
                alt="Tarang Logo" 
                width={36} 
                height={36} 
                className={styles.logoImage} 
              />
              <span className={styles.logo}>Tarang</span>
            </div>
            <p className={styles.tagline}>
              Powerful voice AI built for creators.
            </p>
          </div>

          <div className={styles.columns}>
            {FOOTER_LINKS.map((col) => (
              <div key={col.title} className={styles.column}>
                <h4 className={styles.columnTitle}>{col.title}</h4>
                <ul className={styles.linkList}>
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className={styles.link}>
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.brandingContainer}>
          <span className={styles.brandingText}>Tarang</span>
        </div>

        <div className={styles.bottom}>
          <span className={styles.copyright}>
            &copy; {currentYear} Tarang. All rights reserved.
          </span>
          <span className={styles.madeBy}>
            <span className={styles.craftedText}>Crafted by</span> <a href="https://www.linkedin.com/in/jaychhaya56" target="_blank" rel="noopener noreferrer" className={styles.jayLink}>Jay</a>
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
