"use client";

import { useState } from "react";
import { useApiClient } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LuArrowLeft, LuShield, LuUpload, LuCloudUpload, LuFileAudio, LuShieldAlert } from "react-icons/lu";
import { useUser } from "@clerk/nextjs";

export default function VoiceInsightUpload() {
  const { user, isLoaded } = useUser();
  const isAdmin = (user?.publicMetadata as Record<string, unknown>)?.role === "admin";
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

      // Mode 1: Direct Cloudflare R2 Upload
      if (uploadMode === "file") {
        if (!selectedFile) {
          setErrorMessage("Please select an audio file to upload.");
          setIsLoading(false);
          return;
        }

        setUploadProgress("Uploading audio file to Cloudflare R2...");
        const formData = new FormData();
        formData.append("file", selectedFile);

        const uploadRes = await authFetch("/api/v1/voice-insight/upload-audio", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        finalAudioUrl = uploadData.audio_url;
      }

      setUploadProgress("Initiating Gladia transcription & Qwen analysis...");
      const res = await authFetch("/api/v1/voice-insight/analyze", {
        method: "POST",
        body: JSON.stringify({
          audio_url: finalAudioUrl,
          filename: filename,
        }),
      });

      if (res.ok) {
        router.push("/voice-insight");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to initiate call analysis.");
    } finally {
      setIsLoading(false);
      setUploadProgress("");
    }
  if (isLoaded && !isAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", gap: "16px", padding: "40px 20px" }}>
        <LuShieldAlert style={{ fontSize: "56px", color: "var(--destructive, #ef4444)" }} />
        <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)" }}>Access Restricted</h2>
        <p style={{ color: "var(--muted-foreground)", maxWidth: "460px", fontSize: "14px", lineHeight: "1.6" }}>
          VoiceInsight is an exclusive police intelligence tool restricted to administrators. You do not have permission to upload call recordings.
        </p>
        <Link href="/" style={{ padding: "12px 24px", backgroundColor: "var(--primary)", color: "var(--primary-foreground)", borderRadius: "8px", fontWeight: 600, textDecoration: "none", marginTop: "8px" }}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "650px", width: "100%", padding: "0 16px", margin: "40px auto" }}>
      <Link href="/voice-insight" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--muted-foreground)", fontSize: "14px", textDecoration: "none" }}>
        <LuArrowLeft /> Back to VoiceInsight Dashboard
      </Link>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: "var(--foreground)", display: "flex", alignItems: "center", gap: "8px" }}>
          <LuShield style={{ color: "var(--primary)" }} /> New Case Analysis
        </h1>
        <p style={{ color: "var(--muted-foreground)", fontSize: "14px" }}>
          Upload a call recording directly to Cloudflare R2 or provide a URL for Gladia transcription & Qwen intelligence extraction.
        </p>
      </div>

      {errorMessage && (
        <div style={{ padding: "12px 16px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", color: "#ef4444", fontSize: "14px" }}>
          {errorMessage}
        </div>
      )}

      {/* Upload Mode Selector */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          type="button"
          onClick={() => setUploadMode("file")}
          style={{
            flex: 1, padding: "10px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
            cursor: "pointer", border: "1px solid var(--border)",
            backgroundColor: uploadMode === "file" ? "var(--primary)" : "var(--card)",
            color: uploadMode === "file" ? "var(--primary-foreground)" : "var(--muted-foreground)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
          }}
        >
          <LuCloudUpload /> Upload Local File (R2)
        </button>
        <button
          type="button"
          onClick={() => setUploadMode("url")}
          style={{
            flex: 1, padding: "10px", borderRadius: "8px", fontSize: "14px", fontWeight: 600,
            cursor: "pointer", border: "1px solid var(--border)",
            backgroundColor: uploadMode === "url" ? "var(--primary)" : "var(--card)",
            color: uploadMode === "url" ? "var(--primary-foreground)" : "var(--muted-foreground)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
          }}
        >
          <LuFileAudio /> Audio URL
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", backgroundColor: "var(--card)", padding: "24px", borderRadius: "12px", border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>Case Identifier / Filename</label>
          <input 
            type="text" 
            required
            placeholder="e.g. Case_2026_08_15_Call_04.mp3"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            style={{ 
              padding: "12px", backgroundColor: "var(--background)", border: "1px solid var(--border)", 
              borderRadius: "8px", color: "var(--foreground)", fontSize: "14px", outline: "none" 
            }}
          />
        </div>

        {uploadMode === "file" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>Select Audio Recording (.mp3, .wav, .m4a)</label>
            <div style={{
              border: "2px dashed var(--border)", padding: "30px 20px", borderRadius: "10px",
              textAlign: "center", backgroundColor: "var(--background)", cursor: "pointer"
            }}>
              <input 
                type="file" 
                accept="audio/*" 
                onChange={handleFileChange}
                style={{ display: "none" }}
                id="audio-file-input"
              />
              <label htmlFor="audio-file-input" style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                <LuCloudUpload style={{ fontSize: "32px", color: "var(--primary)" }} />
                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>
                  {selectedFile ? selectedFile.name : "Click to browse or drop call recording audio"}
                </span>
                <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>
                  {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB` : "Files will be encrypted and stored in Cloudflare R2"}
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>Call Recording Audio URL</label>
            <input 
              type="url" 
              required
              placeholder="https://storage.provider.com/audio/call.mp3"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              style={{ 
                padding: "12px", backgroundColor: "var(--background)", border: "1px solid var(--border)", 
                borderRadius: "8px", color: "var(--foreground)", fontSize: "14px", outline: "none" 
              }}
            />
          </div>
        )}

        {uploadProgress && (
          <p style={{ color: "var(--primary)", fontSize: "13px", fontWeight: 600, margin: 0 }}>
            {uploadProgress}
          </p>
        )}

        <button 
          type="submit" 
          disabled={isLoading}
          style={{
            marginTop: "8px", padding: "14px", backgroundColor: "var(--primary)", 
            color: "var(--primary-foreground)", borderRadius: "8px", fontWeight: 600, fontSize: "14px",
            opacity: isLoading ? 0.7 : 1, cursor: isLoading ? "not-allowed" : "pointer", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
          }}>
          <LuUpload /> {isLoading ? "Processing Pipeline..." : "Analyze Call Recording"}
        </button>
      </form>
    </div>
  );
}
