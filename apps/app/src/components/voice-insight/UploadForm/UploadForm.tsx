"use client";

import { useState } from "react";
import { useApiClient } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LuArrowLeft, LuShield, LuUpload, LuCloudUpload, LuFileAudio, LuLoaderCircle, LuCheck } from "react-icons/lu";
import styles from "./UploadForm.module.css";

export function UploadForm() {
  const { authFetch } = useApiClient();
  const router = useRouter();

  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [filename, setFilename] = useState("call_recording_01.mp3");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState("");
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState("hi");
  const [progressStage, setProgressStage] = useState<"uploading" | "transcribing" | "redirecting">("uploading");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFilename(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setProgressStage("uploading");
    setErrorMessage("");
    setUploadProgress("");

    try {
      let finalAudioUrl = audioUrl;
      let audioR2Key: string | undefined;

      if (uploadMode === "file") {
        if (!selectedFile) {
          setErrorMessage("Please select an audio file to upload.");
          setIsLoading(false);
          return;
        }
        setUploadProgress("Uploading audio to Cloudflare R2...");
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await authFetch("/api/v1/voice-insight/upload-audio", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        finalAudioUrl = uploadData.audio_url;
        audioR2Key = uploadData.r2_key;
      }

      setProgressStage("transcribing");
      setUploadProgress("Starting Gladia transcription and Sarvam-30B analysis...");
      const res = await authFetch("/api/v1/voice-insight/analyze", {
        method: "POST",
      body: JSON.stringify({
        audio_url: finalAudioUrl,
        audio_r2_key: audioR2Key,
        filename,
        source_language: sourceLanguage || undefined,
        translation: translationEnabled,
        translation_target_language: translationEnabled ? translationTargetLanguage : undefined,
      }),
      });

      if (res.ok) {
        setProgressStage("redirecting");
        const data = await res.json();
        router.push(`/voice-insight/${data.id}`);
      }
    } catch (err: unknown) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to initiate call analysis.");
    } finally {
      setIsLoading(false);
      setUploadProgress("");
    }
  };

  return (
    <div className={styles.container}>
      <Link href="/voice-insight" className={styles.backLink}>
        <LuArrowLeft /> Back to VoiceInsight
      </Link>

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>
          <LuShield className={styles.titleIcon} /> New Case Analysis
        </h1>
        <p className={styles.subtitle}>
          Upload a call recording or provide a URL for Gladia transcription and Sarvam-30B intelligence extraction.
        </p>
      </div>

      {errorMessage && <div className={styles.errorBox}>{errorMessage}</div>}

      <div className={styles.modeSelector}>
        <button
          type="button"
          onClick={() => setUploadMode("file")}
          className={`${styles.modeBtn} ${uploadMode === "file" ? styles.modeBtnActive : styles.modeBtnInactive}`}
        >
          <LuCloudUpload /> Upload File
        </button>
        <button
          type="button"
          onClick={() => setUploadMode("url")}
          className={`${styles.modeBtn} ${uploadMode === "url" ? styles.modeBtnActive : styles.modeBtnInactive}`}
        >
          <LuFileAudio /> Audio URL
        </button>
      </div>

      {isLoading ? (
        <section className={styles.progressPanel} aria-live="polite">
          <div className={styles.progressHeading}><LuLoaderCircle className={styles.spinner} /> Processing your recording</div>
          <div className={styles.progressSteps}>
            <ProgressStep label="Audio uploaded" done={progressStage !== "uploading"} active={progressStage === "uploading"} />
            <ProgressStep label="Language detection and transcription" done={progressStage === "redirecting"} active={progressStage === "transcribing"} />
            <ProgressStep label="Opening case report" done={false} active={progressStage === "redirecting"} />
          </div>
          <p className={styles.progressText}>{uploadProgress || "Preparing your analysis..."}</p>
        </section>
      ) : <form onSubmit={handleSubmit} className={styles.form}>
        <div>
          <label className={styles.fieldLabel}>Case Identifier / Filename</label>
          <input
            type="text"
            required
            placeholder="e.g. Case_2026_08_24_Call_01.mp3"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className={styles.textInput}
            style={{ width: "100%" }}
          />
        </div>

        {uploadMode === "file" ? (
          <div>
            <label className={styles.fieldLabel}>Select Audio Recording (.mp3, .wav, .m4a)</label>
            <div className={styles.dropzone}>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
                id="audio-file-input"
              />
              <label htmlFor="audio-file-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <LuCloudUpload className={styles.dropzoneIcon} />
                <span className={styles.dropzoneText}>
                  {selectedFile ? selectedFile.name : "Click to browse or drop audio file"}
                </span>
                <span className={styles.dropzoneSubtext}>
                  {selectedFile
                    ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                    : "Encrypted and stored in Cloudflare R2"}
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div>
            <label className={styles.fieldLabel}>Call Recording Audio URL</label>
            <input
              type="url"
              required
              placeholder="https://storage.provider.com/audio/call.mp3"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              className={styles.textInput}
              style={{ width: "100%" }}
            />
          </div>
        )}

        <div className={styles.languageOption}>
          <label className={styles.fieldLabel} htmlFor="source-language">Source language in audio</label>
          <p className={styles.fieldHint}>Recommended for better accuracy. Leave as Auto-detect if the audio contains multiple languages.</p>
          <select id="source-language" value={sourceLanguage} onChange={(e) => setSourceLanguage(e.target.value)} className={styles.textInput}>
            <option value="">Auto-detect</option>
            <option value="hi">Hindi</option><option value="ta">Tamil</option><option value="te">Telugu</option>
            <option value="en">English</option><option value="gu">Gujarati</option><option value="mr">Marathi</option>
            <option value="bn">Bengali</option><option value="kn">Kannada</option><option value="ml">Malayalam</option>
            <option value="pa">Punjabi</option><option value="ur">Urdu</option>
          </select>
        </div>

        <div className={styles.translationOption}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={translationEnabled}
              onChange={(e) => setTranslationEnabled(e.target.checked)}
            />
            <span>
              <strong>Translate transcript</strong>
              <small>Auto-detect the spoken language and translate it into your chosen language.</small>
            </span>
          </label>
          {translationEnabled && (
            <label className={styles.targetLanguageLabel}>
              Translate to
              <select
                value={translationTargetLanguage}
                onChange={(e) => setTranslationTargetLanguage(e.target.value)}
                className={styles.textInput}
              >
                <option value="hi">Hindi</option>
                <option value="en">English</option>
                <option value="ta">Tamil</option>
                <option value="te">Telugu</option>
                <option value="mr">Marathi</option>
                <option value="bn">Bengali</option>
                <option value="gu">Gujarati</option>
                <option value="kn">Kannada</option>
                <option value="ml">Malayalam</option>
                <option value="pa">Punjabi</option>
              </select>
            </label>
          )}
        </div>

        {uploadProgress && <p className={styles.progressText}>{uploadProgress}</p>}

        <button type="submit" disabled={isLoading} className={styles.submitBtn}>
          <LuUpload /> {isLoading ? "Processing Pipeline..." : "Analyze Call Recording"}
        </button>
      </form>}
    </div>
  );
}

function ProgressStep({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return <div className={`${styles.progressStep} ${active ? styles.progressStepActive : ""}`}><span>{done ? <LuCheck /> : active ? <LuLoaderCircle className={styles.spinner} /> : ""}</span>{label}</div>;
}
