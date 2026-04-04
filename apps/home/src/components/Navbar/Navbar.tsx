"use client";

import styles from "./Navbar.module.css";

interface NavbarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

const Navbar = ({ activeTab, setActiveTab }: NavbarProps) => {
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'creations', label: 'Creations' },
    { id: 'features', label: 'Features' },
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <div className={`${styles.navWrapper} fade-in-up`} style={{ animationDelay: '0.2s' }}>
      <nav className={styles.navbar}>
        {navItems.map((item) => {
          const isActive = activeTab === item.label;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab?.(item.label);
              }}
            >
              <span className={styles.navLabel}>{item.label}</span>
            </a>
          );
        })}
      </nav>
    </div>
  );
};

export default Navbar;
