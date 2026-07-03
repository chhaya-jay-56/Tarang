"use client";

import { useReveal } from "@/lib/useReveal";
import styles from "./Pricing.module.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

interface PlanFeature {
  text: string;
  enabled: boolean;
  badge?: string;
}

interface Plan {
  name: string;
  price: string;
  originalPrice?: string;
  period: string;
  credits: string;
  creditsEquivalent: string;
  desc: string;
  features: PlanFeature[];
  cta: string;
  highlighted: boolean;
  queueType: string;
}

const PLANS: Plan[] = [
  {
    name: "Lite",
    price: "$5",
    period: "/month",
    credits: "10,000",
    creditsEquivalent: "~20 min TTS · 5 voice slots",
    desc: "billed monthly · cancel anytime",
    queueType: "Standard queue",
    features: [
      { text: "Text to Speech", enabled: true },
      { text: "Instant Voice Cloning", enabled: true },
      { text: "Voice Library", enabled: true },
      { text: "Voice Creation", enabled: true },
      { text: "Voice Separation", enabled: true },
      { text: "History (30 days)", enabled: true },
      { text: "Priority processing", enabled: false },
    ],
    cta: "Get Lite",
    highlighted: false,
  },
  {
    name: "Starter",
    price: "$9",
    period: "/month",
    credits: "60,000",
    creditsEquivalent: "~120 min TTS · 30 voice slots",
    desc: "billed monthly · cancel anytime",
    queueType: "Priority queue",
    features: [
      { text: "Text to Speech", enabled: true },
      { text: "Instant Voice Cloning", enabled: true },
      { text: "Voice Library", enabled: true },
      { text: "Voice Creation", enabled: true },
      { text: "Voice Separation", enabled: true },
      { text: "Unlimited history", enabled: true },
      { text: "Priority processing", enabled: true },
    ],
    cta: "Upgrade to Starter",
    highlighted: true,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    credits: "250,000",
    creditsEquivalent: "~500 min TTS · Unlimited voice slots",
    desc: "billed monthly · cancel anytime",
    queueType: "Priority queue",
    features: [
      { text: "Text to Speech", enabled: true },
      { text: "Instant Voice Cloning", enabled: true },
      { text: "Voice Library", enabled: true },
      { text: "Voice Creation", enabled: true },
      { text: "Voice Separation", enabled: true },
      { text: "Unlimited history", enabled: true },
      { text: "Priority processing", enabled: true },
      { text: "Personal Voice Cloning", enabled: true, badge: "SOON" },
    ],
    cta: "Upgrade to Pro",
    highlighted: false,
  },
];

const CheckIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    className={styles.checkIcon}
  >
    <path
      d="M4 8L7 11L12 5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CrossIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    className={styles.crossIcon}
  >
    <path
      d="M4 4L12 12M12 4L4 12"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Pricing = () => {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section id="pricing" className={styles.section} ref={sectionRef}>
      <div className={styles.container}>
        <div className={`${styles.header} reveal`}>
          <span className={styles.badge}>PRICING</span>
          <h2 className={styles.heading}>
            Simple, transparent
            <br />
            <span className={styles.headingAccent}>pricing</span>
          </h2>
          <p className={styles.subtitle}>
            Start free. Scale as you grow. No hidden fees.
          </p>
        </div>

        <div className={styles.grid}>
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={`${styles.card} ${plan.highlighted ? styles.cardHighlighted : ""} reveal reveal-delay-${i + 1}`}
            >
              {/* Top row: Plan badge + queue type */}
              <div className={styles.cardTopRow}>
                <span
                  className={`${styles.planBadge} ${plan.highlighted ? styles.planBadgePro : styles.planBadgeStarter}`}
                >
                  {plan.name.toUpperCase()}
                </span>
                {plan.highlighted && (
                  <span className={styles.popularBadge}>Most popular</span>
                )}
                {!plan.highlighted && (
                  <span className={styles.queueLabel}>{plan.queueType}</span>
                )}
              </div>

              {/* Price */}
              <div className={styles.priceRow}>
                <span className={styles.price}>{plan.price}</span>
                {plan.originalPrice && (
                  <span className={styles.originalPrice}>
                    {plan.originalPrice}
                  </span>
                )}
                <span className={styles.period}>{plan.period}</span>
              </div>
              <p className={styles.billingNote}>{plan.desc}</p>

              {/* CTA */}
              <a
                href={APP_URL}
                className={`${styles.planCta} ${plan.highlighted ? styles.planCtaHighlighted : ""}`}
              >
                {plan.cta}
              </a>

              <hr className={styles.divider} />

              {/* Credit info box */}
              <div className={styles.creditInfo}>
                <div className={styles.creditCountInfo}>
                  <span className={styles.creditCountText}>{plan.credits}</span>
                  <span className={styles.creditLabelText}>credits monthly</span>
                </div>
                <div className={styles.creditEquivInfo}>
                  {plan.creditsEquivalent}
                </div>
              </div>

              {/* Features */}
              <ul className={styles.features}>
                {plan.features.map((feat) => (
                  <li
                    key={feat.text}
                    className={`${styles.featureItem} ${!feat.enabled ? styles.featureDisabled : ""}`}
                  >
                    {feat.enabled ? <CheckIcon /> : <CrossIcon />}
                    <span>{feat.text}</span>
                    {feat.badge && (
                      <span className={styles.soonBadge}>{feat.badge}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Pricing;
