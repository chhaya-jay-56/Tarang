"use client";

import Link from "next/link";
import { LuPlus } from "react-icons/lu";
import { Hatch } from "ldrs/react";
import "ldrs/react/Hatch.css";
import { Button } from "@/components/ui/button";
import { VoiceCard } from "@/components/voice-library/VoiceCard/VoiceCard";
import { useVoiceLibrary } from "@/hooks/useVoiceLibrary";
import styles from "./page.module.css";

export default function VoiceLibraryPage() {
  const {
    customVoices,
    presetVoices,
    isLoading,
    error,
    deleteVoice,
  } = useVoiceLibrary();

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>Voice Library</h1>
          <p className={styles.subheading}>
            Your collection of saved and pre-built voices for cloning and TTS.
          </p>
        </div>
        <Link href="/voice-creation">
          <Button variant="outline" className={styles.createNavBtn}>
            <LuPlus />
            Create Voice
          </Button>
        </Link>
      </div>

      {/* ── Your Voices ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Your Voices</h2>
        {isLoading ? (
          <div className={styles.loadingState}>
            <Hatch size="28" stroke="4" speed="3.5" color="currentColor" />
            <span>Loading voices...</span>
          </div>
        ) : customVoices.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🎤</div>
            <p className={styles.emptyTitle}>No custom voices yet</p>
            <p className={styles.emptySubtitle}>
              Create your first voice by uploading reference audio.
            </p>
            <Link href="/voice-creation">
              <Button variant="outline" size="sm" className={styles.emptyBtn}>
                <LuPlus /> Create Voice
              </Button>
            </Link>
          </div>
        ) : (
          <div className={styles.voiceGrid}>
            {customVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                id={voice.id}
                name={voice.name}
                description={voice.description}
                language={voice.language}
                isPreset={voice.is_preset}
                audioUrl={voice.audio_url}
                onDelete={deleteVoice}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Pre-built Voices ── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Pre-built Voices</h2>
        {presetVoices.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptySubtitle}>No preset voices available yet.</p>
          </div>
        ) : (
          <div className={styles.voiceGrid}>
            {presetVoices.map((voice) => (
              <VoiceCard
                key={voice.id}
                id={voice.id}
                name={voice.name}
                description={voice.description}
                language={voice.language}
                isPreset={voice.is_preset}
                audioUrl={voice.audio_url}
              />
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
