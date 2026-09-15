"use client";

import { useState, useMemo, useCallback } from "react";
import styles from "./LanguageMatrix.module.css";

interface LanguageFeature {
  language: string;
  script: string;
  tts: boolean;
  cloning: boolean;
  emotion: boolean;
  quality: "Excellent" | "Great" | "Good";
}

const ALL_LANGUAGES: LanguageFeature[] = [
  { language: "Hindi", script: "हिन्दी", tts: true, cloning: true, emotion: true, quality: "Excellent" },
  { language: "Tamil", script: "தமிழ்", tts: true, cloning: true, emotion: true, quality: "Excellent" },
  { language: "Bengali", script: "বাংলা", tts: true, cloning: true, emotion: true, quality: "Excellent" },
  { language: "Marathi", script: "मराठी", tts: true, cloning: true, emotion: true, quality: "Excellent" },
  { language: "Telugu", script: "తెలుగు", tts: true, cloning: true, emotion: true, quality: "Great" },
  { language: "Gujarati", script: "ગુજરાતી", tts: true, cloning: true, emotion: true, quality: "Great" },
  { language: "Kannada", script: "ಕನ್ನಡ", tts: true, cloning: true, emotion: true, quality: "Great" },
  { language: "Malayalam", script: "മലയാളം", tts: true, cloning: true, emotion: true, quality: "Great" },
  { language: "Urdu", script: "اردو", tts: true, cloning: true, emotion: false, quality: "Great" },
  { language: "Punjabi", script: "ਪੰਜਾਬੀ", tts: true, cloning: true, emotion: false, quality: "Good" },
  { language: "English", script: "English", tts: true, cloning: true, emotion: true, quality: "Excellent" },
  { language: "Spanish", script: "Español", tts: true, cloning: true, emotion: true, quality: "Excellent" },
  { language: "French", script: "Français", tts: true, cloning: true, emotion: true, quality: "Excellent" },
  { language: "Japanese", script: "日本語", tts: true, cloning: true, emotion: true, quality: "Great" },
  { language: "Korean", script: "한국어", tts: true, cloning: true, emotion: true, quality: "Great" },
  { language: "Chinese", script: "中文", tts: true, cloning: true, emotion: true, quality: "Great" },
  { language: "Arabic", script: "العربية", tts: true, cloning: true, emotion: false, quality: "Great" },
  { language: "German", script: "Deutsch", tts: true, cloning: true, emotion: true, quality: "Excellent" },
  { language: "Portuguese", script: "Português", tts: true, cloning: true, emotion: true, quality: "Great" },
  { language: "Russian", script: "Русский", tts: true, cloning: true, emotion: true, quality: "Great" },
];

type FilterValue = "all" | "indian" | "global";

interface LanguageMatrixProps {
  /** Optionally highlight a specific language row */
  highlight?: string;
}

const LanguageMatrix = ({ highlight }: LanguageMatrixProps) => {
  const [filter, setFilter] = useState<FilterValue>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const indianLanguages = new Set([
    "Hindi", "Tamil", "Bengali", "Marathi", "Telugu",
    "Gujarati", "Kannada", "Malayalam", "Urdu", "Punjabi",
  ]);

  const filteredLanguages = useMemo(() => {
    let result = ALL_LANGUAGES;

    if (filter === "indian") {
      result = result.filter((l) => indianLanguages.has(l.language));
    } else if (filter === "global") {
      result = result.filter((l) => !indianLanguages.has(l.language));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.language.toLowerCase().includes(q) ||
          l.script.toLowerCase().includes(q)
      );
    }

    return result;
  }, [filter, searchQuery]);

  const handleFilterChange = useCallback((value: FilterValue) => {
    setFilter(value);
  }, []);

  const qualityBadgeClass = (quality: string) => {
    switch (quality) {
      case "Excellent":
        return styles.qualityExcellent;
      case "Great":
        return styles.qualityGreat;
      default:
        return styles.qualityGood;
    }
  };

  return (
    <div className={styles.container}>
      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.filters}>
          {(["all", "indian", "global"] as FilterValue[]).map((value) => (
            <button
              key={value}
              className={`${styles.filterBtn} ${filter === value ? styles.active : ""}`}
              onClick={() => handleFilterChange(value)}
            >
              {value === "all" ? "All Languages" : value === "indian" ? "🇮🇳 Indian" : "🌍 Global"}
            </button>
          ))}
        </div>
        <input
          type="text"
          className={styles.search}
          placeholder="Search language..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search languages"
        />
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Language</th>
              <th>Script</th>
              <th>Text-to-Speech</th>
              <th>Voice Cloning</th>
              <th>Emotion</th>
              <th>Quality</th>
            </tr>
          </thead>
          <tbody>
            {filteredLanguages.map((lang, idx) => (
              <tr
                key={lang.language}
                className={`${styles.row} ${highlight === lang.language ? styles.highlighted : ""}`}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                <td className={styles.langCell}>
                  <span className={styles.langName}>{lang.language}</span>
                </td>
                <td className={styles.scriptCell}>{lang.script}</td>
                <td>
                  <span className={lang.tts ? styles.supported : styles.unsupported}>
                    {lang.tts ? "✓" : "—"}
                  </span>
                </td>
                <td>
                  <span className={lang.cloning ? styles.supported : styles.unsupported}>
                    {lang.cloning ? "✓" : "—"}
                  </span>
                </td>
                <td>
                  <span className={lang.emotion ? styles.supported : styles.unsupported}>
                    {lang.emotion ? "✓" : "—"}
                  </span>
                </td>
                <td>
                  <span className={`${styles.qualityBadge} ${qualityBadgeClass(lang.quality)}`}>
                    {lang.quality}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLanguages.length === 0 && (
        <p className={styles.empty}>No languages match your search.</p>
      )}
    </div>
  );
};

export default LanguageMatrix;
