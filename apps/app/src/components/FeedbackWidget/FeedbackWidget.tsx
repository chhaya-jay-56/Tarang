"use client";

import { useState, useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import styles from "./FeedbackWidget.module.css";

const FeedbackWidget = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      if (!name) setName(user.fullName || "");
      if (!email) setEmail(user.primaryEmailAddress?.emailAddress || "");
    }
  }, [user, name, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !message) {
      setError("Name and message are required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      const response = await fetch("/api/feedback/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          email,
          message,
          source: "studio",
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || `Feedback could not be submitted (${response.status}).`);
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsSuccess(false);
        setMessage("");
      }, 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button className={styles.topBarBtn} onClick={() => setIsOpen(true)}>
        Feedback
      </button>

      {isOpen && (
        <div className={styles.modalOverlay} onClick={() => !isSubmitting && setIsOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {isSuccess ? (
              <div className={styles.successMessage}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Thank you!</h3>
                <p>Your feedback has been sent directly to the builder.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} suppressHydrationWarning>
                <h3 className={styles.modalTitle}>Talk directly to the builder</h3>
                <p className={styles.modalSubtitle}>What can we improve? What didn&apos;t you like?</p>
                
                {error && <p style={{ color: '#ef4444', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}

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
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsOpen(false)} disabled={isSubmitting} suppressHydrationWarning>
                    Cancel
                  </button>
                  <button type="submit" className={styles.submitBtn} disabled={isSubmitting} suppressHydrationWarning>
                    {isSubmitting ? "Sending..." : "Send Feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackWidget;
