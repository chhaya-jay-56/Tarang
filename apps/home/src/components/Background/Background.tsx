"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import styles from "./Background.module.css";

const DarkVeil = dynamic(() => import("@/components/ReactBits/DarkVeil"), {
  ssr: false,
});

const Background = () => {
  const [opacity, setOpacity] = useState(1);

  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    const heroHeight = window.innerHeight;
    // Fade from 1 → 0.12 as user scrolls past the hero
    const fade = Math.max(0.12, 1 - (scrollY / heroHeight) * 0.88);
    setOpacity(fade);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div
      className={styles.backgroundEffects}
      style={{ opacity, transition: "opacity 0.3s ease" }}
    >
      {/* Base WebGL DarkVeil Background */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <DarkVeil
          hueShift={0}
          noiseIntensity={0.02}
          scanlineIntensity={1}
          speed={1}
          scanlineFrequency={2.7}
          warpAmount={2.1}
        />
      </div>

      <div className={styles.noiseOverlay}></div>
    </div>
  );
};

export default Background;
