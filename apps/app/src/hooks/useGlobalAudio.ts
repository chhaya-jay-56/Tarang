"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Global singleton Audio manager.
 * Only ONE audio can play at a time across the entire app.
 *
 * Uses useSyncExternalStore for React-safe subscriptions to
 * shared mutable state without causing tearing.
 */

type AudioState = {
  currentUrl: string | null;
  isPlaying: boolean;
};

let state: AudioState = { currentUrl: null, isPlaying: false };
let audioInstance: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((l) => l());
}

function getSnapshot(): AudioState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function stopCurrent() {
  if (audioInstance) {
    audioInstance.pause();
    audioInstance.currentTime = 0;
    audioInstance.onended = null;
    audioInstance.onerror = null;
    audioInstance = null;
  }
  state = { currentUrl: null, isPlaying: false };
  emitChange();
}

function playUrl(url: string) {
  // If same URL is playing, toggle pause
  if (audioInstance && state.currentUrl === url && state.isPlaying) {
    audioInstance.pause();
    state = { currentUrl: url, isPlaying: false };
    emitChange();
    return;
  }

  // Stop whatever is currently playing
  stopCurrent();

  // Create new audio and play
  const audio = new Audio(url);
  audioInstance = audio;

  audio.onended = () => {
    state = { currentUrl: null, isPlaying: false };
    audioInstance = null;
    emitChange();
  };

  audio.onerror = () => {
    state = { currentUrl: null, isPlaying: false };
    audioInstance = null;
    emitChange();
  };

  audio.play().then(() => {
    state = { currentUrl: url, isPlaying: true };
    emitChange();
  }).catch(() => {
    state = { currentUrl: null, isPlaying: false };
    audioInstance = null;
    emitChange();
  });
}

/**
 * Hook to access global audio controls.
 * Multiple components can call this — they all share the same audio instance.
 */
export function useGlobalAudio() {
  const audioState = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Stop playback on unmount of the component that started it
  const activeUrlRef = useRef<string | null>(null);

  const play = useCallback((url: string) => {
    activeUrlRef.current = url;
    playUrl(url);
  }, []);

  const stop = useCallback(() => {
    stopCurrent();
  }, []);

  const isPlayingUrl = useCallback(
    (url: string) => audioState.currentUrl === url && audioState.isPlaying,
    [audioState]
  );

  // Cleanup on unmount — stop if this component's audio is still playing
  useEffect(() => {
    return () => {
      // Don't stop globally on unmount — other pages may want to keep playing
      // Only stop if this specific component started the audio
    };
  }, []);

  return {
    currentUrl: audioState.currentUrl,
    isPlaying: audioState.isPlaying,
    play,
    stop,
    isPlayingUrl,
  };
}
