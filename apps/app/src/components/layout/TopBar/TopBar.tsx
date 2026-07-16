"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useUser, UserButton, Show, SignInButton, SignUpButton } from "@clerk/nextjs";
import { CreditBar } from "@/components/layout/CreditBar/CreditBar";
import { useLayoutStore } from "@/stores/layoutStore";
import styles from "./TopBar.module.css";

/**
 * Map pathname segments to human-readable page names.
 * Falls back to title-cased segment if not found here.
 */
const PAGE_NAMES: Record<string, string> = {
  "": "Home",
  "instant-voice-clone": "Voice Cloning",
  "voice-library": "Voice Library",
  "voice-creation": "Voice Creation",
  "text-to-speech": "Text to Speech",
  "voice-separation": "Voice Separation",
  "pvc": "PVC",
  "history": "History",
  "admin": "Admin",
};

function getPageName(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "";
  return PAGE_NAMES[last] || last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Sticky top bar — Neon-style breadcrumb showing:
 *   / username / plan / current page
 *
 * Always visible when scrolling. Replaces per-page <Breadcrumb>.
 */
export function TopBar() {
  const { user, isLoaded } = useUser();
  const pathname = usePathname();
  const pageName = getPageName(pathname);
  const isHome = pathname === "/";
  const { toggleSidebar } = useLayoutStore();

  const displayName = user?.firstName || user?.username || "User";

  return (
    <div className={styles.topBar}>
      {/* ── Left: Breadcrumb path ── */}
      <div className={styles.leftSection}>
        {/* Mobile Sidebar Toggle */}
        <button 
          suppressHydrationWarning
          className="lg:hidden p-2 -ml-2 mr-2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={toggleSidebar}
          aria-label="Toggle Menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <div className={styles.pathSection}>
        {/* Username + Plan badge (side by side) */}
        <span className={styles.pathSegment}>
          <Link href="/" className={styles.pathLink}>
            {isLoaded ? displayName : "…"}
          </Link>
          <span className={`${styles.planBadge} ${styles.planFree}`}>
            FREE
          </span>
        </span>

        {/* Current page */}
        {!isHome && (
          <>
            <span className={styles.separator}>/</span>
            <span className={styles.pathSegment}>
              <span className={styles.pathCurrent}>{pageName}</span>
            </span>
          </>
        )}
        </div>
      </div>

      {/* ── Right: Credit bar + User actions ── */}
      <div className={styles.rightSection}>
        <Show when="signed-in">
          <CreditBar />
          <UserButton />
        </Show>
        <Show when="signed-out">
          <SignInButton />
          <SignUpButton />
        </Show>
      </div>
    </div>
  );
}
