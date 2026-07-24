import { useCallback } from "react";
import styles from "./SpeedControl.module.css";

type SpeedControlProps = {
  value: number;
  onChange: (speed: number) => void;
};

const MIN = 0.5;
const MAX = 1.5;
const STEP = 0.1;

/**
 * Speed slider for OmniVoice generation.
 * Maps 0.5× → 1.5× with 0.1 increments.
 */
export function SpeedControl({ value, onChange }: SpeedControlProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange]
  );

  // Map value to a 0–100 percentage for the gradient fill
  const fillPercent = ((value - MIN) / (MAX - MIN)) * 100;

  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="speed-slider">
        Speed
      </label>

      <div className={styles.sliderRow}>
        <span className={styles.bound}>0.5×</span>

        <div className={styles.sliderWrap}>
          <input
            id="speed-slider"
            type="range"
            min={MIN}
            max={MAX}
            step={STEP}
            value={value}
            onChange={handleChange}
            className={styles.slider}
            style={{
              background: `linear-gradient(to right, var(--speed-accent) 0%, var(--speed-accent) ${fillPercent}%, var(--speed-track) ${fillPercent}%, var(--speed-track) 100%)`,
            }}
          />
        </div>

        <span className={styles.bound}>1.5×</span>
      </div>

      <span className={styles.valueLabel}>{value.toFixed(1)}×</span>
    </div>
  );
}
