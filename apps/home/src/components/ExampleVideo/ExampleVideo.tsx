"use client";

import { useRef, useEffect, useState } from "react";

interface ExampleVideoProps {
  src: string;
  poster: string;
  ariaLabel: string;
  className?: string;
}

/**
 * Client-side video component that avoids hydration mismatches
 * caused by Sentry's browserTracingIntegration adding data-video attributes.
 */
const ExampleVideo = ({ src, poster, ariaLabel, className }: ExampleVideoProps) => {
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render a placeholder with matching dimensions during SSR/initial render
    return (
      <div
        className={className}
        style={{ background: "#050505" }}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className={className}
      controls
      playsInline
      preload="metadata"
      poster={poster}
      aria-label={ariaLabel}
    >
      <source src={src} type="video/mp4" />
      Your browser does not support embedded video.
    </video>
  );
};

export default ExampleVideo;
