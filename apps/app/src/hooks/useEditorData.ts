"use client";

import { useState, useCallback, useEffect } from "react";
import { useApiClient } from "@/lib/api";

// ── Types ──

export interface DubJobSummary {
  job_id: string;
  source_language: string;
  target_language: string;
  status: string;
  current_phase: string;
  progress_pct: number;
  created_at: string | null;
  file_name: string;
  total_segments: number;
  cloned_segments: number;
}

export interface DubSegmentInfo {
  status: string;
  duration_ms: number | null;
  provider: string | null;
  model_name: string | null;
  r2_url: string | null;
  error_message: string | null;
}

export interface EditorSegment {
  index: number;
  start_sec: number;
  end_sec: number;
  duration_sec: number;
  original_text: string;
  translated_text: string;
  speaker_id: number;
  dub: DubSegmentInfo | null;
}

export interface SpeakerMeta {
  speaker_id: number;
  segment_count: number;
  total_duration_sec: number;
}

export interface EditorJobDetail {
  id: string;
  source_language: string;
  target_language: string;
  status: string;
  current_phase: string;
  progress_pct: number;
  created_at: string | null;
  translation_provider: string | null;
}

export interface EditorData {
  job: EditorJobDetail;
  dubbed_video_url: string | null;
  original_video_url: string | null;
  original_video_expired: boolean;
  audio_duration: number;
  speakers: SpeakerMeta[];
  segments: EditorSegment[];
}

// ── Hook: Job List ──

export function useEditorJobs() {
  const { authFetch } = useApiClient();
  const [jobs, setJobs] = useState<DubJobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/dub/editor/jobs");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.detail || "Failed to load jobs");
      }
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return { jobs, loading, error, refetch: fetchJobs };
}

// ── Hook: Single Job Editor Data ──

export function useEditorDetail(jobId: string | null) {
  const { authFetch } = useApiClient();
  const [data, setData] = useState<EditorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/dub/editor/${jobId}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body?.detail || "Failed to load editor data");
      }
      const body = await res.json();
      setData(body);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [jobId, authFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
