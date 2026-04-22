"use client";

import { useEffect, useState, useCallback } from "react";
import { useApiClient } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  LuHistory,
  LuLoader,
  LuDownload,
  LuUpload,
  LuClock3,
  LuCircleCheck,
  LuCircleX,
  LuCirclePlay,
} from "react-icons/lu";

interface HistoryMeta {
  filename?: string;
  text?: string;
  engine?: string;
  size_bytes?: number;
  duration_seconds?: number;
  cloned_size_bytes?: number;
  cloned_duration_seconds?: number;
  original_filename?: string;
  error?: string;
}

interface HistoryEntry {
  id: string;
  voice_id: string | null;
  action: string;
  metadata: HistoryMeta | null;
  created_at: string | null;
  download_url?: string;
}

const ACTION_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  uploaded: {
    label: "Voice Uploaded",
    icon: <LuUpload className="text-[15px]" />,
    color: "text-blue-400",
  },
  clone_started: {
    label: "Clone Started",
    icon: <LuCirclePlay className="text-[15px]" />,
    color: "text-amber-400",
  },
  clone_completed: {
    label: "Clone Completed",
    icon: <LuCircleCheck className="text-[15px]" />,
    color: "text-emerald-400",
  },
  clone_failed: {
    label: "Clone Failed",
    icon: <LuCircleX className="text-[15px]" />,
    color: "text-red-400",
  },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds: number | undefined) {
  if (!seconds) return "—";
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export default function HistoryPage() {
  const { authFetch } = useApiClient();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || "Failed to load history");
      setEntries(data.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDownload = async (downloadUrl: string, filename?: string) => {
    try {
      const audioRes = await fetch(downloadUrl);
      const blob = await audioRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || "cloned_voice.wav";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      alert("Download failed");
    }
  };

  // Empty state
  if (!isLoading && entries.length === 0 && !error) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[22px] font-semibold text-foreground tracking-wide">
            History
          </h1>
          <p className="text-muted-foreground text-sm">
            All your past voice generations appear here.
          </p>
        </div>
        <Card className="border-dashed border-2 border-border bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center min-h-[400px] text-center gap-4 py-16">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <LuHistory className="text-xl text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-medium text-foreground">
                No past generations
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                You haven&apos;t generated any cloned voices yet. Your past
                generations will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full px-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold text-foreground tracking-wide">
          History
        </h1>
        <p className="text-muted-foreground text-sm">
          All your past voice generations appear here.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <LuLoader className="text-2xl animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const config = ACTION_CONFIG[entry.action] || {
              label: entry.action,
              icon: <LuHistory className="text-[15px]" />,
              color: "text-muted-foreground",
            };
            const meta = entry.metadata;

            return (
              <div
                key={entry.id}
                className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3"
              >
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex items-center justify-center h-8 w-8 rounded-lg bg-muted/50 ${config.color}`}
                    >
                      {config.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-foreground">
                        {config.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <LuClock3 className="text-[11px]" />
                        {formatDate(entry.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Download button for completed clones */}
                  {entry.action === "clone_completed" && entry.download_url && (
                    <button
                      onClick={() =>
                        handleDownload(
                          entry.download_url!,
                          `${meta?.original_filename || "voice"}_cloned.wav`
                        )
                      }
                      className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors border border-border rounded-[8px] px-3 py-1.5 text-[12px] font-medium shadow-sm bg-muted/20 hover:bg-muted/40"
                    >
                      <LuDownload className="text-[14px]" />
                      Download
                    </button>
                  )}
                </div>

                {/* Metadata details */}
                {meta && (
                  <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[12px] text-muted-foreground pl-[42px]">
                    {meta.original_filename && (
                      <span>
                        <span className="text-foreground/60 font-medium">
                          File:
                        </span>{" "}
                        {meta.original_filename}
                      </span>
                    )}
                    {meta.filename && !meta.original_filename && (
                      <span>
                        <span className="text-foreground/60 font-medium">
                          File:
                        </span>{" "}
                        {meta.filename}
                      </span>
                    )}
                    {meta.engine && (
                      <span>
                        <span className="text-foreground/60 font-medium">
                          Engine:
                        </span>{" "}
                        {meta.engine}
                      </span>
                    )}
                    {meta.duration_seconds != null && (
                      <span>
                        <span className="text-foreground/60 font-medium">
                          Duration:
                        </span>{" "}
                        {formatDuration(meta.duration_seconds)}
                      </span>
                    )}
                    {meta.cloned_duration_seconds != null && (
                      <span>
                        <span className="text-foreground/60 font-medium">
                          Cloned Duration:
                        </span>{" "}
                        {formatDuration(meta.cloned_duration_seconds)}
                      </span>
                    )}
                    {meta.size_bytes != null && (
                      <span>
                        <span className="text-foreground/60 font-medium">
                          Size:
                        </span>{" "}
                        {formatBytes(meta.size_bytes)}
                      </span>
                    )}
                    {meta.cloned_size_bytes != null && (
                      <span>
                        <span className="text-foreground/60 font-medium">
                          Cloned Size:
                        </span>{" "}
                        {formatBytes(meta.cloned_size_bytes)}
                      </span>
                    )}
                    {meta.error && (
                      <span className="text-red-400">
                        <span className="font-medium">Error:</span>{" "}
                        {meta.error}
                      </span>
                    )}
                  </div>
                )}

                {/* Cloned text (shown for clone_started and clone_completed) */}
                {meta?.text && (
                  <div className="pl-[42px]">
                    <p className="text-[12px] text-muted-foreground/80 italic leading-relaxed line-clamp-2">
                      &ldquo;{meta.text}&rdquo;
                    </p>
                  </div>
                )}

                {/* Voice ID */}
                {entry.voice_id && (
                  <div className="pl-[42px]">
                    <span className="text-[10px] text-muted-foreground/50 font-mono">
                      voice: {entry.voice_id.slice(0, 8)}…
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
