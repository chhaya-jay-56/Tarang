"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import ShinyText from "@/components/ShinyText/ShinyText";
import styles from "./Navbar.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

const PRODUCT_ITEMS = [
  {
    title: "Text to Speech",
    desc: "Generate clean voice from scripts",
  },
  {
    title: "Voice Cloning",
    desc: "Create a replica of your voice",
  },
  {
    title: "Voice Separation",
    desc: "Extract vocals from noisy or mixed audio",
  },
  {
    title: "Voice Library",
    desc: "Browse hundreds of AI voices",
  },
  {
    title: "Voice Creation",
    desc: "Fine-tune every detail of a voice",
  },
];

const NAV_LINKS = [
  { id: "product", label: "Product", hasDropdown: true },
  { id: "how-it-works", label: "How it Works", hasDropdown: false },
  { id: "blog", label: "Blog", hasDropdown: false, href: "/blog" },
  { id: "contact", label: "Contact", hasDropdown: false },
];

const Navbar = () => {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 20);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      setMobileMenuOpen(false);
      setDropdownOpen(false);
      if (pathname === "/") {
        e.preventDefault();
        const section = document.getElementById(id);
        if (section) {
          section.scrollIntoView({ behavior: "smooth" });
        } else {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    },
    [pathname]
  );

  return (
    <header
      className={`${styles.navbar} ${scrolled ? styles.scrolled : ""}`}
      id="navbar"
    >
      <div className={styles.inner}>
        {/* Logo */}
        <div className={styles.leftSection}>
          <a
            href={pathname === "/" ? "#home" : "/"}
            className={styles.logo}
            onClick={(e) => handleNavClick(e, "home")}
          >
            <img src="/Logo.svg" alt="Tarang Logo" className={styles.logoSvg} />
            <ShinyText
              text="Tarang"
              disabled={false}
              speed={3}
              className={styles.logoText}
            />
            <span className={styles.betaBadge}>β</span>
          </a>
        </div>

        {/* Desktop Nav Links */}
        <nav className={styles.navLinks}>
          {NAV_LINKS.map((link) => {
            const targetHref = link.href
              ? link.href
              : pathname === "/"
              ? `#${link.id}`
              : `/#${link.id}`;

            return link.hasDropdown ? (
              <div
                key={link.id}
                className={styles.dropdownWrapper}
                onMouseEnter={() => setDropdownOpen(true)}
                onMouseLeave={() => setDropdownOpen(false)}
              >
                <a
                  href={targetHref}
                  className={styles.navLink}
                  onClick={(e) => handleNavClick(e, link.id)}
                >
                  {link.label}
                  <svg
                    className={`${styles.chevron} ${dropdownOpen ? styles.chevronOpen : ""}`}
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M3 4.5L6 7.5L9 4.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>

                {/* Dropdown */}
                <div
                  className={`${styles.dropdown} ${dropdownOpen ? styles.dropdownVisible : ""}`}
                >
                  <div className={styles.dropdownGrid}>
                    {PRODUCT_ITEMS.map((item) => (
                      <div key={item.title} className={styles.dropdownItem}>
                        <span className={styles.dropdownItemTitle}>
                          {item.title}
                        </span>
                        <span className={styles.dropdownItemDesc}>
                          {item.desc}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : link.href ? (
              <a
                key={link.id}
                href={link.href}
                className={styles.navLink}
              >
                {link.label}
              </a>
            ) : (
              <a
                key={link.id}
                href={targetHref}
                className={styles.navLink}
                onClick={(e) => handleNavClick(e, link.id)}
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* CTA */}
        <div className={styles.cta}>
          <a href={APP_URL} className={styles.ctaButton}>
            Get Started &rarr;
          </a>
        </div>

        {/* Mobile Hamburger */}
        <button
          className={`${styles.hamburger} ${mobileMenuOpen ? styles.hamburgerOpen : ""}`}
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {/* Mobile Menu */}
      <div
        className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileMenuOpen : ""}`}
      >
        {NAV_LINKS.map((link) => {
          const targetHref = link.href
            ? link.href
            : pathname === "/"
            ? `#${link.id}`
            : `/#${link.id}`;

          return link.href ? (
            <a
              key={link.id}
              href={link.href}
              className={styles.mobileNavLink}
            >
              {link.label}
            </a>
          ) : (
            <a
              key={link.id}
              href={targetHref}
              className={styles.mobileNavLink}
              onClick={(e) => handleNavClick(e, link.id)}
            >
              {link.label}
            </a>
          );
        })}
        <a href={APP_URL} className={styles.mobileCta}>
          Get Started &rarr;
        </a>
      </div>
    </header>
  );
};

export default Navbar;
