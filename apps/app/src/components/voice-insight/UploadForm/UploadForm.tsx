"use client";

import { useState } from "react";
import { useApiClient } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LuArrowLeft, LuShield, LuUpload, LuCloudUpload, LuFileAudio } from "react-icons/lu";
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

      setUploadProgress("Starting Gladia transcription and Sarvam-30B analysis...");
      const res = await authFetch("/api/v1/voice-insight/analyze", {
        method: "POST",
      body: JSON.stringify({ audio_url: finalAudioUrl, audio_r2_key: audioR2Key, filename }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/voice-insight/${data.id}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to initiate call analysis.");
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

      <form onSubmit={handleSubmit} className={styles.form}>
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

        {uploadProgress && <p className={styles.progressText}>{uploadProgress}</p>}

        <button type="submit" disabled={isLoading} className={styles.submitBtn}>
          <LuUpload /> {isLoading ? "Processing Pipeline..." : "Analyze Call Recording"}
        </button>
      </form>
    </div>
  );
}
