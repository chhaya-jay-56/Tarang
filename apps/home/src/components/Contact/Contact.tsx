"use client";

import { useReveal } from "@/lib/useReveal";
import styles from "./Contact.module.css";

const Contact = () => {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section id="contact" className={styles.section} ref={sectionRef}>
      <div className={styles.container}>
        <div className={styles.content}>
          <div className={`${styles.info} reveal`}>
            <span className={styles.badge}>CONTACT</span>
            <h2 className={styles.heading}>
              Let&apos;s build something
              <br />
              <span className={styles.headingAccent}>together</span>
            </h2>
            <p className={styles.subtitle}>
              Have questions, feedback, or partnership ideas? We&apos;d love to hear
              from you.
            </p>

            <div className={styles.contactMethods}>
              <a href="mailto:jaychhaya3489@gmail.com" className={styles.method}>
                <span className={styles.methodIcon}>✉️</span>
                <div>
                  <span className={styles.methodLabel}>Email</span>
                  <span className={styles.methodValue}>jaychhaya3489@gmail.com</span>
                </div>
              </a>
              
              <a href="https://www.linkedin.com/in/jaychhaya56" target="_blank" rel="noopener noreferrer" className={styles.method}>
                <span className={styles.methodIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                    <rect x="2" y="9" width="4" height="12"></rect>
                    <circle cx="4" cy="4" r="2"></circle>
                  </svg>
                </span>
                <div>
                  <span className={styles.methodLabel}>LinkedIn</span>
                  <span className={styles.methodValue}>Connect with Jay</span>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
