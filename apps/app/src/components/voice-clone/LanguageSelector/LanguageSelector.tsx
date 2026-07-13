"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { LuChevronDown, LuCheck } from "react-icons/lu";
import styles from "./LanguageSelector.module.css";
import { POPULAR_LANGUAGES, ALL_LANGUAGES, type Language } from "./languages";
import { PRESET_SCRIPTS } from "./scriptTranslations";

type LanguageSelectorProps = {
  value: string;
  onChange: (languageId: string) => void;
  onLanguageScriptChange?: (script: string | null) => void;
  label?: string;
  placeholder?: string;
};

export function LanguageSelector({
  value,
  onChange,
  onLanguageScriptChange,
  label = "Target Language",
  placeholder = "Auto-detect (optional)",
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    setSearch("");
  }, []);

  const handleSelect = useCallback(
    (lang: Language) => {
      onChange(lang.id);
      // Auto-fill preset translated script if available
      if (onLanguageScriptChange) {
        const script = PRESET_SCRIPTS[lang.id] ?? null;
        onLanguageScriptChange(script);
      }
      setIsOpen(false);
      setSearch("");
    },
    [onChange, onLanguageScriptChange]
  );

  // Find selected language name
  const selectedName = useMemo(() => {
    if (!value) return null;
    const found =
      POPULAR_LANGUAGES.find((l) => l.id === value) ||
      ALL_LANGUAGES.find((l) => l.id === value);
    return found?.name || value;
  }, [value]);

  // Filter languages by search
  const filteredPopular = useMemo(() => {
    if (!search) return POPULAR_LANGUAGES;
    const q = search.toLowerCase();
    return POPULAR_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredAll = useMemo(() => {
    if (!search) return ALL_LANGUAGES;
    const q = search.toLowerCase();
    return ALL_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)
    );
  }, [search]);

  // Deduplicate: remove popular items from "all" when showing both
  const filteredOther = useMemo(() => {
    const popularIds = new Set(filteredPopular.map((l) => l.id));
    return filteredAll.filter((l) => !popularIds.has(l.id));
  }, [filteredPopular, filteredAll]);

  return (
    <div className={styles.selectorWrapper}>
      <span className={styles.label}>{label}</span>
      <div className={styles.dropdownContainer} ref={containerRef}>
        <button suppressHydrationWarning
          type="button"
          className={styles.trigger}
          onClick={handleToggle}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          id="language-selector"
        >
          <span className={selectedName ? styles.triggerText : `${styles.triggerText} ${styles.placeholder}`}>
            {selectedName || placeholder}
          </span>
          <LuChevronDown
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          />
        </button>

        {isOpen && (
          <div className={styles.dropdown} role="listbox">
            <div className={styles.searchWrapper}>
              <input
                ref={searchRef}
                type="text"
                className={styles.searchInput}
                placeholder="Every language you speak, we speak too"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className={styles.listContainer}>
              {/* Auto-detect option */}
              {!search && (
                <button suppressHydrationWarning
                  type="button"
                  className={`${styles.option} ${!value ? styles.optionSelected : ""}`}
                  onClick={() => { onChange(""); setIsOpen(false); }}
                  role="option"
                  aria-selected={!value}
                >
                  <span>Auto-detect</span>
                  {!value && <LuCheck />}
                </button>
              )}

              {/* Popular languages */}
              {filteredPopular.length > 0 && (
                <>
                  <div className={styles.groupLabel}>Popular</div>
                  {filteredPopular.map((lang) => (
                    <button suppressHydrationWarning
                      key={`pop-${lang.id}`}
                      type="button"
                      className={`${styles.option} ${value === lang.id ? styles.optionSelected : ""}`}
                      onClick={() => handleSelect(lang)}
                      role="option"
                      aria-selected={value === lang.id}
                    >
                      <span>{lang.name}</span>
                      <span className={styles.optionId}>
                        {value === lang.id ? <LuCheck /> : lang.id}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* All other languages */}
              {filteredOther.length > 0 && (
                <>
                  <div className={styles.groupLabel}>All Languages</div>
                  {filteredOther.map((lang) => (
                    <button suppressHydrationWarning
                      key={`all-${lang.id}`}
                      type="button"
                      className={`${styles.option} ${value === lang.id ? styles.optionSelected : ""}`}
                      onClick={() => handleSelect(lang)}
                      role="option"
                      aria-selected={value === lang.id}
                    >
                      <span>{lang.name}</span>
                      <span className={styles.optionId}>
                        {value === lang.id ? <LuCheck /> : lang.id}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {filteredPopular.length === 0 && filteredOther.length === 0 && (
                <div className={styles.noResults}>No languages found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
