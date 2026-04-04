"use client";

import dynamic from "next/dynamic";
import styles from "./Background.module.css";

const DarkVeil = dynamic(() => import("@/components/ReactBits/DarkVeil"), {
  ssr: false,
});

const Ribbons = dynamic(() => import("@/components/ReactBits/Ribbons"), {
  ssr: false,
});

const Background = () => {
  return (
    <div className={styles.backgroundEffects}>
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

      {/* Floating WebGL Ribbons over the veil */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 1, pointerEvents: 'none' }}>
        <Ribbons
          colors={['#ffffff', '#ff4d4d', '#7828ff']}
          enableFade={true}
          pointCount={40}
        />
      </div>

      <div className={styles.noiseOverlay}></div>
    </div>
  );
};

export default Background;
