"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { 
  LuCloudUpload, 
  LuLoader, 
  LuX, 
  LuMusic, 
  LuUpload,
  LuDownload,
  LuRotateCcw
} from "react-icons/lu";
import { FaPlay, FaPause, FaBackward, FaForward } from "react-icons/fa6";

import { useApiClient } from "@/lib/api";
import WaveSurfer from 'wavesurfer.js';
import { useVoiceCloneStore } from "@/stores/voiceCloneStore";

// ── Pipeline stages in order (for the stepper) ──
const PIPELINE_STAGES = [
  { key: "queued", label: "Starting" },
  { key: "downloading_reference", label: "Preparing" },
  { key: "uploading_to_ai", label: "Uploading" },
  { key: "model_loading", label: "Loading model" },
  { key: "model_running", label: "Cloning" },
  { key: "downloading_output", label: "Processing" },
  { key: "saving_to_storage", label: "Saving" },
  { key: "completed", label: "Done" },
] as const;

export default function InstantVoiceClonePage() {
  const { authFetch } = useApiClient();

  // ── Zustand store (replaces all useState) ──
  const {
    voiceId, setVoiceId,
    text, setText,
    clonedAudioUrl, setClonedAudioUrl,
    file, setFile,
    isUploading, setIsUploading,
    isCloning, setIsCloning,
    cloneStage, stageMessage,
    setCloneProgress, cloneError, setCloneError,
    clear,
  } = useVoiceCloneStore();

  // Reference audio preview (local only — not in store)
  const previewUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurfer = useRef<WaveSurfer | null>(null);
  const clonedContainerRef = useRef<HTMLDivElement>(null);
  const clonedWavesurfer = useRef<WaveSurfer | null>(null);

  // Playback state (local — WaveSurfer event-driven)
  const isPlayingPreviewRef = useRef(false);
  const isPlayingClonedRef = useRef(false);

  // Force re-render counter — drives play/pause icon + time display updates
  const [, setRenderTick] = useState(0);
  const forceUpdate = useCallback(() => setRenderTick((n) => n + 1), []);

  // Polling ref
  const pollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveFailsRef = useRef(0);

  // Time display refs
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const clonedCurrentTimeRef = useRef(0);
  const clonedDurationRef = useRef(0);

  // ── Preview URL lifecycle ──
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      return () => {
        URL.revokeObjectURL(url);
        previewUrlRef.current = null;
      };
    } else {
      previewUrlRef.current = null;
    }
  }, [file]);

  // ── Init WaveSurfer for reference audio ──
  useEffect(() => {
    if (!containerRef.current || !file) return;

    const url = URL.createObjectURL(file);

    const rootStyles = getComputedStyle(document.documentElement);
    const progressHex = rootStyles.getPropertyValue('--foreground').trim() || '#fafafa';
    const waveHex = rootStyles.getPropertyValue('--border').trim() || '#27272a';

    wavesurfer.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: waveHex,
      progressColor: progressHex,
      barWidth: 3,
      barGap: 3,
      barRadius: 4,
      height: 72,
      url,
      cursorWidth: 0,
      normalize: true, 
      barHeight: 1.2,
    });

    wavesurfer.current.on('play', () => { isPlayingPreviewRef.current = true; forceUpdate(); });
    wavesurfer.current.on('pause', () => { isPlayingPreviewRef.current = false; forceUpdate(); });
    wavesurfer.current.on('timeupdate', (time) => { currentTimeRef.current = time; forceUpdate(); });
    wavesurfer.current.on('ready', (d) => { durationRef.current = d; forceUpdate(); });

    return () => {
      wavesurfer.current?.destroy();
      URL.revokeObjectURL(url);
    };
  }, [file, forceUpdate]);

  // ── Init WaveSurfer for cloned audio ──
  useEffect(() => {
    if (!clonedContainerRef.current || !clonedAudioUrl) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const progressHex = rootStyles.getPropertyValue('--foreground').trim() || '#fafafa';
    const waveHex = rootStyles.getPropertyValue('--border').trim() || '#27272a';

    clonedWavesurfer.current = WaveSurfer.create({
      container: clonedContainerRef.current,
      waveColor: waveHex,
      progressColor: progressHex,
      barWidth: 3,
      barGap: 3,
      barRadius: 4,
      height: 72,
      url: clonedAudioUrl,
      cursorWidth: 0,
      normalize: true,
      barHeight: 1.2,
    });

    clonedWavesurfer.current.on('play', () => { isPlayingClonedRef.current = true; forceUpdate(); });
    clonedWavesurfer.current.on('pause', () => { isPlayingClonedRef.current = false; forceUpdate(); });
    clonedWavesurfer.current.on('timeupdate', (t) => { clonedCurrentTimeRef.current = t; forceUpdate(); });
    clonedWavesurfer.current.on('ready', (d) => { clonedDurationRef.current = d; forceUpdate(); });

    return () => {
      clonedWavesurfer.current?.destroy();
    };
  }, [clonedAudioUrl, forceUpdate]);

  // ── Playback controls ──
  const togglePreviewPlay = useCallback(() => wavesurfer.current?.playPause(), []);
  const jumpBack = useCallback(() => wavesurfer.current?.skip(-5), []);
  const jumpForward = useCallback(() => wavesurfer.current?.skip(5), []);
  const toggleClonedPlay = useCallback(() => clonedWavesurfer.current?.playPause(), []);
  const clonedJumpBack = useCallback(() => clonedWavesurfer.current?.skip(-5), []);
  const clonedJumpForward = useCallback(() => clonedWavesurfer.current?.skip(5), []);

  // ── Helpers ──
  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "Unknown error";
  };

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // ── File selection ──
  const setSelectedFile = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setVoiceId(null);
    setClonedAudioUrl(null);
    setCloneError(null);
    setCloneProgress("", "");
  }, [setFile, setVoiceId, setClonedAudioUrl, setCloneError, setCloneProgress]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  }, [setSelectedFile]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.includes("audio")) {
        setSelectedFile(droppedFile);
      }
    }
  }, [setSelectedFile]);

  const clearFile = useCallback(() => clear(), [clear]);

  // ── Cleanup polling on unmount ──
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
    };
  }, []);

  // ── Upload handler ──
  const handleUpload = useCallback(async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await authFetch("/api/voices/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
         let msg = "Failed to upload to backend";
         if (typeof uploadData.detail === 'string') msg = uploadData.detail;
         else if (uploadData.detail) msg = JSON.stringify(uploadData.detail);
         throw new Error(msg);
      }

      setVoiceId(uploadData.voice_id);
    } catch (err: unknown) {
      alert(`Upload failed: ${getErrorMessage(err)}`);
    } finally {
      setIsUploading(false);
    }
  }, [file, authFetch, setIsUploading, setVoiceId]);

  // ── Clone + poll handler ──
  const handleClone = useCallback(async () => {
    if (!voiceId || !text) return;
    setIsCloning(true);
    setClonedAudioUrl(null);
    setCloneError(null);
    setCloneProgress("queued", "Starting clone...");

    // Cache voiceId to avoid stale closures
    const currentVoiceId = voiceId;

    try {
      const res = await authFetch(`/api/voices/${currentVoiceId}/clone`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || "Clone failed");
      }

      // Start polling with recursive setTimeout (avoids async overlap)
      consecutiveFailsRef.current = 0;
      const startTime = Date.now();
      const POLL_INTERVAL_MS = 3000;
      const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

      const poll = async () => {
        // Timeout check
        if (Date.now() - startTime > TIMEOUT_MS) {
          setCloneError("Clone is taking too long. Please try again.");
          setIsCloning(false);
          return;
        }

        try {
          console.log("[poll] fetching status...");
          const statusRes = await authFetch(`/api/voices/${currentVoiceId}/status`);
          const statusData = await statusRes.json();
          console.log("[poll] response:", statusData);
          consecutiveFailsRef.current = 0;

          if (statusData.status === "succeeded") {
            console.log("[poll] clone succeeded, output_url:", statusData.output_url);
            setCloneProgress("completed", "Clone complete!");
            setClonedAudioUrl(statusData.output_url);
            setIsCloning(false);
            return; // Stop polling
          } else if (statusData.status === "failed") {
            setCloneError(statusData.error_message || "Clone failed");
            setCloneProgress("failed", statusData.stage_message || "Clone failed.");
            setIsCloning(false);
            return; // Stop polling
          } else {
            // Still processing — update stage and schedule next poll
            setCloneProgress(
              statusData.clone_stage || "processing",
              statusData.stage_message || "Processing..."
            );
          }
        } catch (err) {
          console.warn("[poll] error:", err);
          consecutiveFailsRef.current += 1;
          if (consecutiveFailsRef.current >= 5) {
            setCloneError("Connection lost. Please check your network and try again.");
            setIsCloning(false);
            return; // Stop polling
          }
        }

        // Schedule next poll
        pollIntervalRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      };

      // First poll after a short delay
      pollIntervalRef.current = setTimeout(poll, POLL_INTERVAL_MS);

    } catch (err: unknown) {
      setCloneError(getErrorMessage(err));
      setIsCloning(false);
    }
  }, [voiceId, text, authFetch, setIsCloning, setClonedAudioUrl, setCloneError, setCloneProgress]);

  // ── Download handler ──
  const handleDownload = useCallback(async () => {
    if (!voiceId) return;
    try {
      const res = await authFetch(`/api/voices/${voiceId}/download`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Download failed");

      const audioRes = await fetch(data.download_url);
      const blob = await audioRes.blob();

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = data.filename || "cloned_voice.wav";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      alert("Download failed: " + getErrorMessage(err));
    }
  }, [voiceId, authFetch]);

  // ── Retry clone ──
  const handleRetry = useCallback(() => {
    setCloneError(null);
    setCloneProgress("", "");
    handleClone();
  }, [setCloneError, setCloneProgress, handleClone]);

  // ── Compute active step index for stepper ──
  const activeStepIndex = PIPELINE_STAGES.findIndex((s) => s.key === cloneStage);

  return (
    <div className="flex flex-col max-w-4xl mx-auto w-full gap-8 px-4">
      <h1 className="text-[22px] font-semibold text-foreground tracking-wide mt-2">
        Clone Voice from Reference Audio
      </h1>

      {file ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col w-full overflow-hidden">
           <div className="p-7 pb-5">
              {/* Top Banner & Close */}
              <div className="flex justify-between items-start mb-8">
                 <div className="bg-foreground text-background flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl font-medium text-[13px] shadow-sm">
                    <LuMusic className="text-[16px]" />
                    <span>Reference Audio (Upload a voice sample to clone)</span>
                 </div>
                 <button onClick={clearFile} className="text-muted-foreground hover:text-foreground transition-colors border border-border rounded-[8px] p-1.5 shadow-sm bg-muted/20 hover:bg-muted/40">
                    <LuX className="text-[18px]" />
                 </button>
              </div>

              {/* Waveform Container */}
              <div ref={containerRef} className="w-full mb-3 cursor-text" />

              {/* Time Display */}
              <div className="flex justify-between text-muted-foreground text-[13px] font-medium mb-5 px-1">
                 <span>{formatTime(currentTimeRef.current)}</span>
                 <span>{formatTime(durationRef.current)}</span>
              </div>

              {/* Media Controls */}
              <div className="flex items-center justify-center px-2">
                 <div className="flex items-center gap-8">
                    <button onClick={jumpBack} className="text-muted-foreground hover:text-foreground transition-colors">
                       <FaBackward className="text-xl" />
                    </button>
                    <button onClick={togglePreviewPlay} className="text-foreground hover:opacity-80 transition-opacity active:scale-[0.98]">
                       {isPlayingPreviewRef.current ? <FaPause className="text-[40px]" /> : <FaPlay className="text-[40px] ml-1" />}
                    </button>
                    <button onClick={jumpForward} className="text-muted-foreground hover:text-foreground transition-colors">
                       <FaForward className="text-xl" />
                    </button>
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-[1.5px] border-dashed border-border/30 hover:border-primary/50 bg-background/5 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4 min-h-[280px] transition-all cursor-pointer hover:bg-background/20 mt-4"
        >
          <div className="h-12 w-12 rounded-full bg-card ring-1 ring-border/20 shadow-sm flex items-center justify-center">
            <LuCloudUpload className="text-xl text-foreground" />
          </div>
          <div className="flex flex-col gap-1 mt-2">
            <p className="text-sm font-semibold text-foreground/80">
              Add or drop your audio files here
            </p>
            <p className="text-xs text-muted-foreground">
              Supports WAV ONLY
            </p>
          </div>
          <input
            type="file"
            accept=".wav"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Transcription Input */}
      <div className="flex flex-col gap-4 mt-2">
        <textarea
          className="w-full min-h-[140px] rounded-[16px] border border-border/50 bg-card/50 px-6 py-5 text-[15px] ring-offset-background placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30 resize-none shadow-sm transition-all text-foreground"
          placeholder="Enter the text you want the cloned voice to speak..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-3 mt-2 mb-10">
        <Button
          variant="outline"
          size="lg"
          className="h-14 px-12 gap-3 text-[13px] font-semibold tracking-[0.1em] rounded-full border-border/40 hover:bg-foreground hover:text-background transition-all text-foreground uppercase shadow-sm"
          disabled={!file || isUploading || !!voiceId}
          onClick={handleUpload}
        >
          {isUploading ? (
            <LuLoader className="text-lg animate-spin" />
          ) : (
            <LuUpload className="text-lg" />
          )}
          {voiceId ? "Uploaded" : isUploading ? "Uploading..." : "Upload Audio"}
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="h-14 px-16 gap-3 text-[13px] font-semibold tracking-[0.1em] rounded-full border-border/40 hover:bg-foreground hover:text-background transition-all text-foreground uppercase shadow-sm"
          disabled={!voiceId || !text || isCloning}
          onClick={handleClone}
        >
          {isCloning && <LuLoader className="text-lg animate-spin" />}
          {isCloning ? "Cloning..." : "Clone Voice"}
        </Button>
      </div>

      {/* ── Progress Card (shown while cloning) ── */}
      {isCloning && cloneStage && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-7 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative h-5 w-5">
              <div className="absolute inset-0 rounded-full border-2 border-foreground/20" />
              <div className="absolute inset-0 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
            </div>
            <p className="text-[15px] font-semibold text-foreground">
              {stageMessage || "Processing..."}
            </p>
          </div>

          {/* Stage stepper */}
          <div className="flex items-center gap-1 px-1">
            {PIPELINE_STAGES.map((stage, idx) => {
              const isCurrent = idx === activeStepIndex;
              const isCompleted = activeStepIndex > idx;

              return (
                <div key={stage.key} className="flex items-center gap-1 flex-1">
                  {/* Dot */}
                  <div className="flex flex-col items-center gap-1.5 min-w-0">
                    <div
                      className={`h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                        isCompleted
                          ? "bg-foreground scale-100"
                          : isCurrent
                          ? "bg-foreground scale-125 ring-4 ring-foreground/20"
                          : "bg-border"
                      }`}
                    />
                    <span
                      className={`text-[10px] leading-tight text-center truncate max-w-[60px] ${
                        isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>

                  {/* Connector line */}
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <div
                      className={`flex-1 h-[2px] rounded-full transition-colors duration-300 ${
                        isCompleted ? "bg-foreground" : "bg-border"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Connection warning */}
          {consecutiveFailsRef.current >= 3 && consecutiveFailsRef.current < 5 && (
            <p className="text-xs text-yellow-500 mt-4 text-center">
              Connection unstable, retrying...
            </p>
          )}
        </div>
      )}

      {/* ── Error Card ── */}
      {cloneError && !isCloning && (
        <div className="bg-card rounded-2xl border border-destructive/50 shadow-sm p-7 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 text-destructive mt-0.5 shrink-0">✕</div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-destructive mb-1">Clone Failed</p>
              <p className="text-[13px] text-muted-foreground">{cloneError}</p>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-[12px] rounded-full"
              onClick={handleRetry}
            >
              <LuRotateCcw className="text-sm" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* ── Cloned Audio Player ── */}
      {clonedAudioUrl && (
        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
          <p className="text-sm font-medium text-foreground tracking-wide uppercase text-center">Cloning Complete</p>

          <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col w-full overflow-hidden">
            <div className="p-7 pb-5">
              {/* Top banner */}
              <div className="flex justify-between items-start mb-8">
                <div className="bg-foreground text-background flex items-center justify-center gap-2.5 px-4 py-2 rounded-xl font-medium text-[13px] shadow-sm">
                  <LuMusic className="text-[16px]" />
                  <span>Cloned Voice Output</span>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors border border-border rounded-[8px] px-3 py-1.5 text-[12px] font-medium shadow-sm bg-muted/20 hover:bg-muted/40"
                >
                  <LuDownload className="text-[15px]" />
                  Download
                </button>
              </div>

              {/* Waveform */}
              <div ref={clonedContainerRef} className="w-full mb-3 cursor-pointer" />

              {/* Time display */}
              <div className="flex justify-between text-muted-foreground text-[13px] font-medium mb-5 px-1">
                <span>{formatTime(clonedCurrentTimeRef.current)}</span>
                <span>{formatTime(clonedDurationRef.current)}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center px-2">
                <div className="flex items-center gap-8">
                  <button onClick={clonedJumpBack} className="text-muted-foreground hover:text-foreground transition-colors">
                    <FaBackward className="text-xl" />
                  </button>
                  <button onClick={toggleClonedPlay} className="text-foreground hover:opacity-80 transition-opacity active:scale-[0.98]">
                    {isPlayingClonedRef.current ? <FaPause className="text-[40px]" /> : <FaPlay className="text-[40px] ml-1" />}
                  </button>
                  <button onClick={clonedJumpForward} className="text-muted-foreground hover:text-foreground transition-colors">
                    <FaForward className="text-xl" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
