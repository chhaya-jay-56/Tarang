"use client";
// Trigger reload

import { useEffect, useRef, useState } from "react";
import { useReveal } from "@/lib/useReveal";
import styles from "./ProductSection.module.css";
import type WaveSurfer from "wavesurfer.js";

const FEATURES = [
  {
    number: "01",
    title: "Text to Speech",
    desc: "Turn text into natural, expressive speech with state-of-the-art AI models.",
    visual: "tts",
    creditCost: "~3 credits/sec",
  },
  {
    number: "02",
    title: "Voice Cloning",
    desc: "Create ultra-realistic vocal replicas from just a few seconds of audio. Our advanced neural networks capture subtle nuances, accents, and emotional inflections, giving you studio-quality clones perfectly tailored for scalable content generation.",
    visual: "clone",
    creditCost: "~200 credits/min",
  },
  {
    number: "03",
    title: "Voice Separation",
    desc: "Isolate vocals and instruments with precision. Studio-grade audio splitting.",
    visual: "separation",
    creditCost: "~10 credits/min",
  },
  {
    number: "04",
    title: "Voice Library",
    desc: "Explore and use hundreds of high-quality AI voices. Find the perfect tone for any project.",
    visual: "library",
    creditCost: "Free to browse",
  },
  {
    number: "05",
    title: "Voice Creation",
    desc: "Fine-tune every detail. Create a voice that's uniquely yours.",
    visual: "creation",
    creditCost: "~200 credits/min",
  },
];

/* Deterministic pseudo-random to avoid SSR/client hydration mismatch */
function seededValue(index: number, seed: number): number {
  const x = Math.sin(index * 9.1 + seed * 3.7) * 43758.5453;
  return x - Math.floor(x);
}

const WaveformPlayer = ({ seed, color, height = 32 }: { seed: number, color: string, height?: number }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  const generatePeaks = (seed: number) => {
    const peaks = [];
    for (let i = 0; i < 80; i++) {
      peaks.push(Math.abs(Math.sin(i * 0.2 + seed)) * 0.7 + Math.random() * 0.3);
    }
    return peaks;
  };

  useEffect(() => {
    let isMounted = true;

    // Clear container to prevent double-initialization DOM issues in Strict Mode / HMR
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
    
    import("wavesurfer.js").then((WaveSurferModule) => {
      if (!isMounted || !containerRef.current) return;
      
      const WaveSurfer = WaveSurferModule.default;
      
      try {
        const ws = WaveSurfer.create({
          container: containerRef.current,
          waveColor: "rgba(255, 255, 255, 0.15)",
          progressColor: color,
          height: height,
          barWidth: 2,
          barGap: 2,
          barRadius: 2,
          cursorWidth: 0,
          interact: false,
        });
        
        ws.load("", [generatePeaks(seed)], 12);
        wsRef.current = ws;
      } catch (e) {
        console.error("WaveSurfer error:", e);
      }
    });

    return () => {
      isMounted = false;
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null; // Clear ref BEFORE destroy to stop animation loop
        try {
          ws.destroy();
        } catch (e) {
          // ignore DOM errors during fast-refresh
        }
      }
      // Clean up the DOM node manually to prevent React 'removeChild' errors
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [color, seed, height]);

  useEffect(() => {
    let animationFrame: number;
    let progress = 0;
    const animate = () => {
      progress += 0.003;
      if (progress > 1) progress = 0;
      if (wsRef.current) {
        try {
          wsRef.current.seekTo(progress);
        } catch(e) {
          // ignore errors on destroyed instances
        }
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div className={styles.playerContainer}>
      <div className={styles.playerWaveform} ref={containerRef}></div>
    </div>
  );
};

const WaveformVisual = () => (
  <div className={styles.innerCard} style={{ minHeight: '120px', justifyContent: 'center' }}>
    <WaveformPlayer seed={2} color="#7828ff" height={80} />
  </div>
);

const TTSVisual = () => (
  <div className={styles.innerCard}>
    <div className={styles.codeBlock}>
      <div className={styles.codeLine}>
        <span className={styles.lineNum}>01</span>
        <span className={styles.codeText}>The future of voice</span>
      </div>
      <div className={styles.codeLine}>
        <span className={styles.lineNum}>02</span>
        <span className={styles.codeText}>
          is here.<span className={styles.cursor}>|</span>
        </span>
      </div>
      <div className={styles.codeLine}>
        <span className={styles.lineNum}>03</span>
        <span className={styles.codeText} />
      </div>
    </div>
    <WaveformPlayer seed={1} color="#7828ff" height={32} />
  </div>
);

const SeparationVisual = () => (
  <div className={styles.separationLayout}>
    {/* Left Side */}
    <div className={styles.sepCardBox}>
       <div className={styles.sepHeader}>
         <span className={styles.sepDot} style={{ background: "#7828ff" }} />
         <span className={styles.sepTitle}>Original Mix</span>
       </div>
       <WaveformPlayer seed={3} color="#7828ff" height={24} />
    </div>
    
    {/* Branching SVG Desktop */}
    <div className={styles.sepBranchDesktop}>
      <svg viewBox="0 0 40 80" fill="none" className={styles.branchSvg}>
         <path d="M 0 40 L 10 40 C 20 40 20 15 30 15 L 40 15" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
         <path d="M 0 40 L 10 40 C 20 40 20 65 30 65 L 40 65" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
      </svg>
    </div>

    {/* Branching SVG Mobile */}
    <div className={styles.sepBranchMobile}>
      <svg viewBox="0 0 24 40" fill="none" className={styles.branchSvgMobile}>
         <path d="M 12 0 L 12 40" stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
         <path d="M 6 34 L 12 40 L 18 34" stroke="rgba(255,255,255,0.2)" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>

    {/* Right Side */}
    <div className={styles.sepRight}>
      <div className={styles.sepCardBox}>
         <div className={styles.sepHeader}>
           <span className={styles.sepDot} style={{ background: "#9945ff" }} />
           <span className={styles.sepTitle}>Vocals (Isolated)</span>
         </div>
         <WaveformPlayer seed={4} color="#9945ff" height={20} />
      </div>
      <div className={styles.sepCardBox}>
         <div className={styles.sepHeader}>
           <span className={styles.sepDot} style={{ background: "#e040fb" }} />
           <span className={styles.sepTitle}>Instrumental</span>
         </div>
         <WaveformPlayer seed={5} color="#e040fb" height={20} />
      </div>
    </div>
  </div>
);

const LibraryVisual = () => {
  const voices = [
    { name: "Priya", type: "Female · Warm", color: "#ff6b6b", bg: "rgba(255, 107, 107, 0.1)" },
    { name: "Alex", type: "Male · Deep", color: "#7828ff", bg: "rgba(120, 40, 255, 0.1)" },
    { name: "Anjali", type: "Female · Calm", color: "#4ecdc4", bg: "rgba(78, 205, 196, 0.1)" },
  ];

  return (
    <div className={styles.libraryVisual}>
      {voices.map((v) => (
        <div key={v.name} className={styles.voiceChip}>
          <div className={styles.voiceAvatar} style={{ background: v.color }}>
            {v.name[0]}
          </div>
          <div className={styles.voiceInfo}>
            <span className={styles.voiceName}>{v.name}</span>
            <span className={styles.voiceType}>{v.type}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const CreationVisual = () => (
  <div className={styles.creationVisual}>
    <div className={styles.slider}>
      <span className={styles.sliderLabel}>Pitch</span>
      <div className={styles.sliderTrack}>
        <div className={styles.sliderFill} style={{ width: "65%" }} />
        <div className={styles.sliderThumb} style={{ left: "65%" }} />
      </div>
    </div>
    <div className={styles.slider}>
      <span className={styles.sliderLabel}>Speed</span>
      <div className={styles.sliderTrack}>
        <div className={styles.sliderFill} style={{ width: "45%" }} />
        <div className={styles.sliderThumb} style={{ left: "45%" }} />
      </div>
    </div>
    <div className={styles.slider}>
      <span className={styles.sliderLabel}>Tone</span>
      <div className={styles.sliderTrack}>
        <div className={styles.sliderFill} style={{ width: "80%" }} />
        <div className={styles.sliderThumb} style={{ left: "80%" }} />
      </div>
    </div>
  </div>
);

const visualMap: Record<string, React.FC> = {
  tts: TTSVisual,
  clone: WaveformVisual,
  separation: SeparationVisual,
  library: LibraryVisual,
  creation: CreationVisual,
};

const ProductSection = () => {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section id="product" className={styles.section} ref={sectionRef}>
      <div className={styles.container}>
        <div className="reveal">
          <span className={styles.badge}>PRODUCT</span>
          <h2 className={styles.heading}>
            Powerful voice AI
            <br />
            built for <span className={styles.headingAccent}>creators</span>
          </h2>
          <p className={styles.subtitle}>
            Everything you need to generate, clone, and manipulate voice with
            state-of-the-art AI models.
          </p>
        </div>

        <div className={styles.grid}>
          {FEATURES.slice(0, 3).map((feat, i) => {
            const Visual = visualMap[feat.visual];
            return (
              <div
                key={feat.number}
                className={`${styles.card} reveal reveal-delay-${i + 1}`}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardNumber}>{feat.number}</span>
                  <h3 className={styles.cardTitle}>{feat.title}</h3>
                </div>
                <p className={styles.cardDesc}>{feat.desc}</p>
                <div className={styles.cardVisual}>
                  {Visual && <Visual />}
                </div>
              </div>
            );
          })}
        </div>



        <div className={styles.grid}>
          {FEATURES.slice(3).map((feat, i) => {
            const Visual = visualMap[feat.visual];
            return (
              <div
                key={feat.number}
                className={`${styles.card} reveal reveal-delay-${i + 1}`}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardNumber}>{feat.number}</span>
                  <h3 className={styles.cardTitle}>{feat.title}</h3>
                </div>
                <p className={styles.cardDesc}>{feat.desc}</p>
                <div className={styles.cardVisual}>
                  {Visual && <Visual />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ProductSection;
