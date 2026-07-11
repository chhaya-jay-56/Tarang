"use client";

import { useState } from "react";
import { LuCopy, LuCheck } from "react-icons/lu";
import styles from "./CopyPromptButton.module.css";

const PROMPT_TEXT = `Act as an expert dialogue writer for voice acting. I am going to give you a Target Emotion and a Rough Script at the bottom of this prompt. 

Your job is to rewrite and format the script specifically for an advanced Text-to-Speech (TTS) engine, adapting the pacing and punctuation to strictly match the emotion I specify. Keep the output in the exact same language I use for my input.

CRITICAL FORMATTING RULES:
The TTS engine relies strictly on punctuation and spacing for its emotional performance. You MUST follow these rules exactly:

1. Zero Emojis:
- You must NOT output any emojis whatsoever. Strip all emojis from the final output, as the TTS engine cannot process them.

2. Dynamic Structure (Pacing & Breaths): 
- Do NOT blindly separate every single sentence with a blank line.
- Group related thoughts together. A text block can have anywhere from 1 to 3 lines depending on the flow of the dialogue.
- Use a completely blank line ONLY when there is a natural beat change, a shift in tone, or where a voice actor would take a significant breath. 

3. Punctuation (Emotion Tags):
- Base your use of these tags entirely on the [Target Emotion] provided below.
- Use "..." frequently for natural pauses, hesitations, or sighs.
- Use "!!!" at the end of sentences for high energy, excitement, or anger.
- Use "?!!" for moments of shock, exasperation, or disbelief.
- Use "," to break up longer sentences and control the storytelling rhythm.

4. Writing Style:
- Write exactly how a human speaks in a casual, everyday conversation. 
- Make it sound natural, not like a formal essay.

---

INPUT:

Rough Script/Idea: 
[PASTE YOUR ROUGH SCRIPT OR IDEA HERE]`;

export function CopyPromptButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_TEXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy prompt", err);
    }
  };

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.trigger}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        onClick={handleCopy}
      >
        {copied ? (
          <LuCheck className={styles.triggerIcon} />
        ) : (
          <LuCopy className={styles.triggerIcon} />
        )}
        {copied ? "Copied!" : "Copy Prompt"}
      </button>

      {isVisible && !copied && (
        <div className={styles.card}>
          Paste this prompt into GPT, GEMINI, or CLAUDE with your script to get an optimized script for synthesization.
        </div>
      )}
    </div>
  );
}
