"use client";

import { useReveal } from "@/lib/useReveal";
import styles from "./HowItWorks.module.css";

// SVG Icons
const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
    <line x1="12" x2="12" y1="19" y2="22" />
  </svg>
);

const BulbIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
    <line x1="9" x2="15" y1="18" y2="18" />
    <line x1="10" x2="14" y1="22" y2="22" />
  </svg>
);

const WaveformIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10v4M6 6v12M9 3v18M12 7v10M15 5v14M18 8v8M21 10v4" />
  </svg>
);

const ScriptIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </svg>
);

const LightningIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" x2="16.65" y1="21" y2="16.65" />
  </svg>
);

const BrainIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

const SpeakerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </svg>
);

const RocketIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.25-2.5 3.5-2.5 3.5s2.25-1 3.5-2.5" />
    <path d="M12 12 4.5 19.5" />
    <path d="M9 15 4 10" />
    <path d="M15 9c2-2 6-3 6-3s-1 4-3 6l-6 6-3-3 6-6Z" />
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ScissorsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <line x1="9.8" y1="8.2" x2="20" y2="18" />
    <line x1="9.8" y1="15.8" x2="20" y2="6" />
  </svg>
);

const SmileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" x2="9.01" y1="9" y2="9" />
    <line x1="15" x2="15.01" y1="9" y2="9" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// Vertical Arrow Connector
const ConnectorArrow = () => (
  <div className={styles.connectorContainer}>
    <svg width="16" height="32" viewBox="0 0 16 32" fill="none" className={styles.connectorSvg}>
      <path d="M8 0V30" stroke="var(--text-secondary)" strokeWidth="1.5" strokeDasharray="4 4" className={styles.dashedLine} />
      <path d="M4 26L8 30L12 26" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const HowItWorks = () => {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section id="how-it-works" className={styles.section} ref={sectionRef}>
      <div className={styles.container}>
        {/* Header Block */}
        <div className={`${styles.header} reveal`}>
          <span className={styles.badge}>HOW IT WORKS</span>
          <h2 className={styles.heading}>
            How <span className={styles.blueAccent}>Tarang</span> works
          </h2>
          <p className={styles.subtitle}>
            From voice preparation to high-fidelity audio synthesis.
          </p>
        </div>

        {/* Vertical Flowchart layout suited for dark theme */}
        <div className={`${styles.flowchart} reveal`}>
          
          {/* Row 1: Source Inputs */}
          <div className={styles.sourcesRow}>
            <div className={styles.sourceCard}>
              <div className={styles.sourceIcon}><MicIcon /></div>
              <span className={styles.sourceTitle}>Have a voice</span>
            </div>
            
            <div className={styles.sourceCard}>
              <div className={styles.sourceIcon}><BulbIcon /></div>
              <span className={styles.sourceTitle}>Have a script</span>
            </div>

            <div className={styles.pillBadge}>
              Creator / Podcaster / Artist
            </div>
          </div>

          <ConnectorArrow />

          {/* Row 2: Target Audience tags */}
          <div className={styles.audienceRow}>
            <div className={styles.audienceHalfRight}>
              <span className={styles.audienceTag}>Content Creators</span>
              <span className={styles.audienceTag}>Podcasters</span>
            </div>
            <div className={styles.audienceHalfLeft}>
              <span className={styles.audienceTag}>Game Studios</span>
              <span className={styles.audienceTag}>Voice Artists</span>
            </div>
          </div>

          <ConnectorArrow />

          {/* Row 3: Dashed User Input Blocks */}
          <div className={styles.inputsRow}>
            <div className={styles.inputBox}>
              <div className={styles.inputBoxIcon}><WaveformIcon /></div>
              <div className={styles.inputBoxContent}>
                <span className={styles.inputBoxTitle}>Voice sample (20-30s)</span>
                <span className={styles.inputBoxSub}>Upload clean MP3, WAV, or recording</span>
              </div>
            </div>

            <div className={styles.inputBox}>
              <div className={styles.inputBoxIcon}><ScriptIcon /></div>
              <div className={styles.inputBoxContent}>
                <span className={styles.inputBoxTitle}>Target script / text</span>
                <span className={styles.inputBoxSub}>Type or paste your text context</span>
              </div>
            </div>
          </div>

          <ConnectorArrow />

          {/* Row 4: Tarang Engine */}
          <div className={styles.engineBox}>
            <div className={styles.engineBadge}>
              <div className={styles.engineBadgeIcon}>
                <img src="/Logo.svg" alt="Tarang Logo" style={{ width: '20px', height: '20px' }} />
              </div>
              <span>TARANG ENGINE</span>
            </div>

            <div className={styles.engineGrid}>
              
              {/* Card 1 */}
              <div className={`${styles.engineCard} ${styles.stepBlue}`}>
                <div className={styles.engineCardHeader}>
                  <span className={styles.engineCardNumber}>1</span>
                  <h4 className={styles.engineCardTitle}>Research & Prep</h4>
                </div>
                <p className={styles.engineCardDesc}>Clean, segment, transcribe</p>
                <div className={styles.engineTags}>
                  <span className={styles.engineTag}>VAD</span>
                  <span className={styles.engineTag}>Denoise</span>
                  <span className={styles.engineTag}>Whisper</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className={`${styles.engineCard} ${styles.stepPurple}`}>
                <div className={styles.engineCardHeader}>
                  <span className={styles.engineCardNumber}>2</span>
                  <h4 className={styles.engineCardTitle}>Clone & Train</h4>
                </div>
                <p className={styles.engineCardDesc}>Build a reusable voice profile</p>
                <div className={styles.engineTags}>
                  <span className={styles.engineTag}>Voice Match</span>
                  <span className={styles.engineTag}>Timbre</span>
                  <span className={styles.engineTag}>GPU</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className={`${styles.engineCard} ${styles.stepOrange}`}>
                <div className={styles.engineCardHeader}>
                  <span className={styles.engineCardNumber}>3</span>
                  <h4 className={styles.engineCardTitle}>Generate & Review</h4>
                </div>
                <p className={styles.engineCardDesc}>Synthesize with emotion control</p>
                <div className={styles.engineTags}>
                  <span className={styles.engineTag}>TTS</span>
                  <span className={styles.engineTag}>Emotion</span>
                  <span className={styles.engineTag}>Preview</span>
                </div>
              </div>

              {/* Card 4 */}
              <div className={`${styles.engineCard} ${styles.stepGreen}`}>
                <div className={styles.engineCardHeader}>
                  <span className={styles.engineCardNumber}>4</span>
                  <h4 className={styles.engineCardTitle}>Download & Export</h4>
                </div>
                <p className={styles.engineCardDesc}>Get studio-quality MP3 / WAV files</p>
                <div className={styles.engineTags}>
                  <span className={styles.engineTag}>MP3</span>
                  <span className={styles.engineTag}>WAV</span>
                  <span className={styles.engineTag}>Download</span>
                </div>
              </div>

            </div>

            <div className={styles.engineBottomRow}>
              <div className={styles.engineTechPill}>
                <WaveformIcon />
                <span>High-fidelity audio synthesis</span>
              </div>
              <div className={styles.engineTechPill}>
                <LockIcon />
                <span>Secure user data isolation</span>
              </div>
            </div>
          </div>

          <ConnectorArrow />

          {/* Row 5: Output Results */}
          <div className={styles.outputsRow}>
            <div className={`${styles.outputPill} ${styles.pillGreen}`}>
              <CheckIcon />
              <span>Voice Clone Ready</span>
            </div>

            <div className={`${styles.outputPill} ${styles.pillBlue}`}>
              <DownloadIcon />
              <span>Audio File Generated</span>
            </div>
          </div>

          {/* Row 6: Bottom Does Card */}
          <div className={styles.doesCard}>
            <h4 className={styles.doesTitle}>What Tarang does</h4>
            <div className={styles.doesPillsGrid}>
              <div className={styles.doesPill}>
                <div className={styles.doesPillIcon}><LightningIcon /></div>
                <span>Clone any voice in 3 seconds</span>
              </div>
              <div className={styles.doesPill}>
                <div className={styles.doesPillIcon}><SmileIcon /></div>
                <span>Emotion-controlled TTS</span>
              </div>
              <div className={styles.doesPill}>
                <div className={styles.doesPillIcon}><GlobeIcon /></div>
                <span>Multi-language output</span>
              </div>
              <div className={styles.doesPill}>
                <div className={styles.doesPillIcon}><UserIcon /></div>
                <span>Personal Voice Creation (PVC)</span>
              </div>
              <div className={styles.doesPill}>
                <div className={styles.doesPillIcon}><ScissorsIcon /></div>
                <span>Vocals & Instrument Splitting</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
