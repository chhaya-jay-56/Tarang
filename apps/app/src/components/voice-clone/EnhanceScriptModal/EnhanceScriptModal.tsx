import { useEffect, useState } from "react";
import { LuX, LuInfo, LuArrowRight, LuCheck, LuTriangleAlert, LuGlobe, LuMic, LuWand, LuSparkles } from "react-icons/lu";
import styles from "./EnhanceScriptModal.module.css";

interface EnhanceScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RAW_SCRIPT = `આજે સવારે તો એટલો બધો ટ્રાફિક હતો કે હું પહોંચવામાં પૂરો એક કલાક મોડો પડ્યો. રોજ આ મેઈન સિગ્નલ પર આવીને ગાડી ઉભી જ રહી જાય છે અને કોઈ આગળ જ નથી વધતું. હું તો કંટાળી ગયો છું રોજ સવારે આ ધુમાડા અને હોર્નના અવાજો સાંભળીને. બાકી આ ટ્રાફિકમાં રોજ મગજ બગાડવા કરતા વહેલા નીકળવું વધારે સારું છે.`;

const ENHANCED_SCRIPT = `આજે સવારે તો એટલો બધો ટ્રાફિક હતો... 

કે હું પહોંચવામાં પૂરો એક કલાક મોડો પડ્યો?!!

રોજ આ મેઈન સિગ્નલ પર આવીને ગાડી ઉભી જ રહી જાય છે... અને કોઈ આગળ જ નથી વધતું!!!

હું તો સાવ કંટાળી ગયો છું... રોજ સવારે આ ધુમાડા અને હોર્નના અવાજો સાંભળીને...

બાકી આ ટ્રાફિકમાં રોજ મગજ બગાડવા કરતા... વહેલા નીકળવું વધારે સારું છે!!!`;

export function EnhanceScriptModal({ isOpen, onClose }: EnhanceScriptModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          <LuX size={24} />
        </button>

        <div className={styles.header}>
          <h2 className={styles.title}>
            Enhanced Script Prompt
          </h2>
          <p className={styles.subtitle}>
            Transform your raw ideas into structured, expressive scripts for realistic voice output.
          </p>
        </div>

        <div className={styles.comparisonContainer}>
          {/* Left Panel: Raw Script */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle} style={{ color: "#ff6b6b" }}>Your Script (Raw Input) <LuInfo size={14} style={{opacity: 0.7, display:'inline', marginLeft:4}} /></h3>
            </div>
            <div className={styles.textareaWrapper}>
              <textarea 
                className={styles.textarea} 
                readOnly 
                value={RAW_SCRIPT}
              />
              <div className={styles.charCount}>{RAW_SCRIPT.length} characters</div>
              <div className={styles.bottomBlur}></div>
            </div>

            <div className={styles.downsidesBox}>
              <h4 className={styles.boxTitle} style={{ color: "#ff6b6b" }}>
                <LuTriangleAlert size={16} /> Downside of unstructured script
              </h4>
              <ul className={styles.list}>
                <li>Lacks clarity and flow</li>
                <li>May sound flat or monotonous</li>
                <li>Missing context, emotions & emphasis</li>
                <li>Less effective for realistic TTS output</li>
              </ul>
            </div>
          </div>

          {/* Center Arrow */}
          <div className={styles.centerArrow}>
            <div className={styles.arrowCircle}>
              <LuArrowRight size={20} />
            </div>
            <div className={styles.arrowText}>
              Enhanced<br/>Format
            </div>
          </div>

          {/* Right Panel: Enhanced Script */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h3 className={styles.panelTitle} style={{ color: "#20c997" }}>Enhanced Prompt (Structured Script) <LuInfo size={14} style={{opacity: 0.7, display:'inline', marginLeft:4}} /></h3>
            </div>
            <div className={styles.textareaWrapper}>
              <textarea 
                className={styles.textarea} 
                readOnly 
                value={ENHANCED_SCRIPT}
              />
              <div className={styles.charCount}>{ENHANCED_SCRIPT.length} characters</div>
              <div className={styles.bottomBlur}></div>
            </div>

            <div className={styles.benefitsBox}>
              <h4 className={styles.boxTitle} style={{ color: "#20c997" }}>
                <LuCheck size={16} /> Why enhanced prompt works better
              </h4>
              <ul className={styles.list}>
                <li>Clear structure and flow</li>
                <li>Natural pacing with emotions & emphasis</li>
                <li>Context-rich for lifelike voice output</li>
                <li>Better results across all AI platforms</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
