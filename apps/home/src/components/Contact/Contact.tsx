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
              <div className={styles.method}>
                <span className={styles.methodIcon}>✉️</span>
                <div>
                  <span className={styles.methodLabel}>Email</span>
                  <span className={styles.methodValue}>hello@tarang.ai</span>
                </div>
              </div>
            </div>
          </div>

          <form
            className={`${styles.form} reveal reveal-delay-2`}
            onSubmit={(e) => e.preventDefault()}
            suppressHydrationWarning
          >
            <div className={styles.formGroup}>
              <label htmlFor="contact-name" className={styles.label}>
                Name
              </label>
              <input
                id="contact-name"
                type="text"
                className={styles.input}
                placeholder="Your name"
                suppressHydrationWarning
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="contact-email" className={styles.label}>
                Email
              </label>
              <input
                id="contact-email"
                type="email"
                className={styles.input}
                placeholder="you@email.com"
                suppressHydrationWarning
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="contact-message" className={styles.label}>
                Message
              </label>
              <textarea
                id="contact-message"
                className={styles.textarea}
                placeholder="Tell us what you're building..."
                rows={5}
              />
            </div>
            <button type="submit" className={styles.submitBtn} suppressHydrationWarning>
              Send Message &rarr;
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Contact;
