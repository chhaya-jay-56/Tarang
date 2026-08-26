"use client";

import { useState, useEffect } from "react";
import styles from "./FeedbackSection.module.css";

const FeedbackSection = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !message) {
      setError("Name and message are required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/feedback/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          message,
          source: "landing_page",
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || `Feedback could not be submitted (${response.status}).`);
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setName("");
        setEmail("");
        setMessage("");
      }, 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="feedback" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.textContent}>
          <h2 className={styles.title}>Talk directly to the builder</h2>
          <p className={styles.subtitle}>
            We're constantly improving Tarang based on your feedback. Tell us what features you'd like to see, what we can improve, or what didn't work for you. Your feedback goes directly to the team.
          </p>
        </div>

        <div className={styles.formContainer}>
          {!isMounted ? null : isSuccess ? (
            <div className={styles.successMessage}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Thank you!</h3>
              <p>Your feedback has been sent directly to the builder.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} suppressHydrationWarning>
              {error && <p style={{ color: '#ff4d4d', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

              <div className={styles.formGroup}>
                <label className={styles.label}>Name *</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Your Name"
                  required
                  suppressHydrationWarning
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Email (Optional)</label>
                <input 
                  type="email" 
                  className={styles.input} 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Your Email"
                  suppressHydrationWarning
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Feedback *</label>
                <textarea 
                  className={styles.textarea} 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  placeholder="Tell us what's on your mind..."
                  required
                  suppressHydrationWarning
                />
              </div>

              <div className={styles.buttonGroup}>
                <button type="submit" className={styles.submitBtn} disabled={isSubmitting} suppressHydrationWarning>
                  {isSubmitting ? "Sending..." : "Send Feedback"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default FeedbackSection;
