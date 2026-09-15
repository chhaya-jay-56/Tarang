"use client";

import { useState, useCallback } from "react";
import styles from "./FaqAccordion.module.css";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAccordionProps {
  items: FaqItem[];
}

const FaqAccordion = ({ items }: FaqAccordionProps) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <div className={styles.accordion}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className={`${styles.item} ${isOpen ? styles.open : ""}`}
          >
            <button
              className={styles.trigger}
              onClick={() => handleToggle(index)}
              aria-expanded={isOpen}
              id={`faq-trigger-${index}`}
              aria-controls={`faq-panel-${index}`}
            >
              <span className={styles.question}>{item.question}</span>
              <span className={styles.icon} aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>
            <div
              id={`faq-panel-${index}`}
              role="region"
              aria-labelledby={`faq-trigger-${index}`}
              className={styles.panel}
              style={{
                maxHeight: isOpen ? "500px" : "0px",
              }}
            >
              <p className={styles.answer}>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FaqAccordion;
