"use client";

import { useState } from "react";
import styles from "./FeedbackWidget.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const FeedbackWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !message) {
      setError("Name and message are required.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/feedback/`, {
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
        throw new Error("Failed to submit feedback");
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setIsSuccess(false);
        setName("");
        setEmail("");
        setMessage("");
      }, 3000);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={styles.widgetContainer} style={{ transform: isOpen ? 'translateY(-50%) translateX(100%)' : 'translateY(-50%)' }}>
        <button className={styles.feedbackButton} onClick={() => setIsOpen(true)}>
          Feedback
        </button>
      </div>

      {isOpen && (
        <div className={styles.modalOverlay} onClick={() => !isSubmitting && setIsOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {isSuccess ? (
              <div className={styles.successMessage}>
                <h3>Thank you!</h3>
                <p>Your feedback has been sent directly to the builder.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <h3 className={styles.modalTitle}>Talk directly to the builder</h3>
                <p className={styles.modalSubtitle}>What can we improve? What didn't you like?</p>
                
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
                  />
                </div>

                <div className={styles.buttonGroup}>
                  <button type="button" className={styles.cancelBtn} onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
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
