# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Modal GPU worker for OmniVoice (k2-fsa/OmniVoice) — 646-language TTS
# with zero-shot voice cloning from 3 seconds of reference audio.
#
# COLD START OPTIMIZATIONS APPLIED:
#   1. GPU Memory Snapshots — snap=True captures GPU state after model load
#      + warm-up pass, so containers restore in ~1-3s instead of ~25s.
#   2. Weights on Modal Volume — "omnivoice-weights" (7.6 GiB) mounted at
#      /model-weights, no HuggingFace download at runtime.
#   3. Global Imports — heavy imports (torch, omnivoice) inside enter(),
#      captured in snapshot.
#   4. Warm-up Pass — dummy forward pass compiles CUDA kernels before
#      snapshot, so first real request is fast.
#
# ARCHITECTURE NOTE (Two-Container Design):
#   clone_api runs on a lightweight CPU container and calls .remote() on the
#   GPU class. This is INTENTIONAL — GPU memory snapshots only work reliably
#   with .remote() calls, NOT with @modal.fastapi_endpoint on @app.cls.
#   Tested: single-container approach caused 50-60s cold starts vs 4s with
#   the two-container .remote() pattern. The CPU container cost (~$0.0003/req)
#   is negligible compared to the GPU startup savings.
#
# DEPLOY: modal deploy apps/ai_workers/omnivoice/modal_app.py
# TEST:   modal serve apps/ai_workers/omnivoice/modal_app.py
# ─────────────────────────────────────────────────────────────────────────────

import base64
import io
import os
import tempfile

import modal
from fastapi import Request, HTTPException
from fastapi.responses import Response


# ─────────────────────────────────────────────────────────────────────────────
# 1. Image & Environment
# ─────────────────────────────────────────────────────────────────────────────

MODEL_DIR = "/model-weights"

# Bump this to force Modal to re-create the snapshot after code changes
SNAPSHOT_KEY = "omnivoice-v6"

# Directory for pre-baked preset voice files (shreya.wav, etc.)
# Cached .pt prompts are saved alongside the audio files on the volume.
PRESET_VOICES_DIR = "/preset-voices"

# Directory for custom voice cached prompts (saved as .pt files)
# Lives on the preset volume alongside preset voices for simplicity.
CUSTOM_PROMPTS_DIR = "/preset-voices/custom"

image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "libsndfile1")
    .pip_install(
        "torch",
        "torchaudio",
        "omnivoice",
        "soundfile",
        "numpy",
        "fastapi",
    )
)

app = modal.App("tarang-omnivoice", image=image)


def _verify_modal_secret(request: Request) -> None:
    expected = os.environ.get("MODAL_SHARED_SECRET")
    if expected and request.headers.get("x-tarang-modal-secret") != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

# Weights already baked into this volume (7.6 GiB)
model_volume = modal.Volume.from_name("omnivoice-weights")

# Preset voice reference audio files (shreya.wav, etc.)
# Upload with: modal volume put tarang-preset-voices ./VoicesForLibrary/shreya.wav
preset_volume = modal.Volume.from_name("tarang-preset-voices", create_if_missing=True)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Model Class — GPU Snapshots + Warm-up Pass
# ─────────────────────────────────────────────────────────────────────────────
# WHY enable_memory_snapshot + snap=True:
#   Without: Container cold-starts in ~20-25s (weight loading → GPU transfer
#   → CUDA kernel compilation). You pay for ALL of that.
#   With: Modal freezes CPU+GPU memory AFTER model is loaded and warmed up.
#   Next cold start restores from snapshot in ~1-3s.
#
# WHY scaledown_window=120:
#   Keeps container alive for 2 min after last request. Even with GPU snapshots,
#   Modal needs to find a GPU host + pull snapshot from remote storage on cold
#   start — which can take 24-45s if the host is new. 120s keeps the container
#   warm across typical request gaps (~$0.024/idle period, negligible vs the
#   cost of 45s cold starts on L4 GPU).

@app.cls(
    gpu="L4",
    cpu=2.0,
    memory=1024 * 8,                                     # 8 GB RAM
    timeout=300,
    min_containers=0,                                     # True serverless ($0 idle)
    scaledown_window=2,                                 # 2min warm window
    enable_memory_snapshot=True,                           # ← CPU memory snapshot
    experimental_options={"enable_gpu_snapshot": True},    # ← GPU memory snapshot
    volumes={
        MODEL_DIR: model_volume,
        PRESET_VOICES_DIR: preset_volume,
    },
)
class OmniVoiceModel:
    @modal.enter(snap=True)
    def load_model(self):
        """Load OmniVoice into GPU memory and warm up CUDA kernels.

        WHY snap=True: Runs ONCE, then Modal snapshots the CPU + GPU state.
        Every subsequent container boot restores from snapshot (~1-3s)
        instead of re-running this code (~20-25s).

        WHY warm-up pass: CUDA lazily compiles kernels on first use.
        The dummy generation forces kernel compilation so it's captured
        in the snapshot — first real request pays zero compilation cost.
        """
        import torch
        from omnivoice import OmniVoice

        print(f"Loading OmniVoice from {MODEL_DIR}...")

        self.model = OmniVoice.from_pretrained(
            MODEL_DIR,
            device_map="cuda:0",
            dtype=torch.float16,
        )

        print("✅ OmniVoice loaded — running warm-up pass...")

        # ── Warm-up: Force CUDA kernel compilation ──
        try:
            _warmup_file = os.path.join(tempfile.gettempdir(), "_warmup.wav")

            # pyrefly: ignore [missing-import]
            import soundfile as sf
            import numpy as np
            silence = np.zeros(12000, dtype=np.float32)  # 0.5s at 24kHz
            sf.write(_warmup_file, silence, 24000)

            _ = self.model.generate(
                text="warmup",
                ref_audio=_warmup_file,
                num_step=32,
            )
            os.unlink(_warmup_file)
        except Exception as e:
            print(f"⚠️ Warm-up pass failed (non-fatal): {e}")

        print(f"✅ OmniVoice ready — snapshot key: {SNAPSHOT_KEY}")

        # Preset voices are now cached dynamically to the volume to avoid 
        # blowing up the snapshot size and causing 3-minute cold starts.

    @modal.enter()
    def post_restore(self):
        """Post-snapshot init — runs on EVERY container start (including restores).

        WHY: After GPU snapshot restore, CUDA context may need a sync before
        kernels are usable. Without this, the first real request can incur a
        1-2s CUDA lazy re-initialization penalty. The sync forces immediate
        GPU readiness.
        """
        import torch
        import time

        t0 = time.perf_counter()
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        elapsed = time.perf_counter() - t0

        print(f"✅ Post-restore CUDA sync done in {elapsed:.2f}s — container ready")

    @modal.method()
    def generate(
        self,
        text: str,
        ref_audio_bytes: bytes,
        language: str,
        speed: float = 1.0,
        cached_voice: str = "",
    ) -> bytes:
        """Generate cloned speech from text + reference audio bytes.

        WHY cached_voice: If this matches a preset voice name (e.g. 'shreya')
        or a custom voice ID, we load the pre-computed .pt prompt from the
        Modal Volume — skipping ~8-12s of Whisper ASR per request.
        """
        # pyrefly: ignore [missing-import]
        import soundfile as sf

        import torch

        # DEBUG: Log what cached_voice value was received
        print(f"[generate] called with cached_voice='{cached_voice}', ref_audio_bytes={len(ref_audio_bytes)} bytes")
        
        # DEBUG: Show what files exist in the preset voices dir
        if os.path.isdir(PRESET_VOICES_DIR):
            files = os.listdir(PRESET_VOICES_DIR)
            print(f"[generate] Files in {PRESET_VOICES_DIR}: {files}")
        if os.path.isdir(CUSTOM_PROMPTS_DIR):
            files = os.listdir(CUSTOM_PROMPTS_DIR)
            print(f"[generate] Files in {CUSTOM_PROMPTS_DIR}: {files}")
        
        cached_prompt = None
        # Only use prompt caching for known presets or UUID-length identifiers.
        # Short/generic names (e.g. "voice") must never be cached — they would
        # cause all direct-upload clones to share one cached prompt, producing
        # the wrong voice for every user after the first.
        KNOWN_PRESETS = {"anjali", "priya", "alex", "david", "samay_raina"}
        is_valid_cache_key = (
            cached_voice
            and (cached_voice.lower() in KNOWN_PRESETS or len(cached_voice) >= 30)
        )
        if is_valid_cache_key:
            voice_name = cached_voice.lower()
            # Check preset voices dir first, then custom voices dir
            pt_path_preset = os.path.join(PRESET_VOICES_DIR, f"{voice_name}.pt")
            pt_path_custom = os.path.join(CUSTOM_PROMPTS_DIR, f"{voice_name}.pt")
            
            # 1. Try to load cached .pt from preset volume
            for pt_path in [pt_path_preset, pt_path_custom]:
                if os.path.exists(pt_path):
                    print(f"Loading cached prompt for '{voice_name}' from {pt_path}...")
                    try:
                        cached_prompt = torch.load(pt_path, map_location="cpu", weights_only=False)
                        break
                    except Exception as e:
                        print(f"⚠️ Failed to load cached prompt {pt_path}: {e}")
            
            # 2. If not found, compute and cache it on-the-fly
            if cached_prompt is None:
                ref_path_for_caching = None
                temp_file = None
                
                # For preset voices, the wav file might be on the volume
                for ext in [".wav", ".mp3", ".flac", ".ogg"]:
                    cand = os.path.join(PRESET_VOICES_DIR, f"{voice_name}{ext}")
                    if os.path.exists(cand):
                        ref_path_for_caching = cand
                        break
                
                # For custom voices, use the provided ref_audio_bytes
                if not ref_path_for_caching and ref_audio_bytes:
                    temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
                    temp_file.write(ref_audio_bytes)
                    temp_file.close() # Close so OmniVoice can read it
                    ref_path_for_caching = temp_file.name

                if ref_path_for_caching:
                    print(f"⏳ Computing and caching prompt for '{voice_name}' to volume...")
                    try:
                        cached_prompt = self.model.create_voice_clone_prompt(ref_audio=ref_path_for_caching)
                        
                        # Save to custom dir if it looks like a UUID, else preset dir
                        save_dir = CUSTOM_PROMPTS_DIR if len(voice_name) > 30 else PRESET_VOICES_DIR
                        os.makedirs(save_dir, exist_ok=True)
                        save_path = os.path.join(save_dir, f"{voice_name}.pt")
                        
                        torch.save(cached_prompt, save_path)
                        preset_volume.commit()
                        print(f"✅ Saved cached prompt to {save_path}")
                    except Exception as e:
                        print(f"⚠️ Failed to cache prompt: {e}")
                    finally:
                        if temp_file:
                            try:
                                os.unlink(temp_file.name)
                            except OSError:
                                pass

        if cached_prompt is not None:
            # Fast path: use pre-computed prompt (no Whisper)
            try:
                audio = self.model.generate(
                    text=text,
                    voice_clone_prompt=cached_prompt,
                    language=language,
                    num_step=32,
                    speed=speed,
                )
                output = io.BytesIO()
                audio_data = audio[0] if isinstance(audio, list) else audio
                sf.write(output, audio_data, 24000, format="WAV")
                return output.getvalue()
            except Exception as e:
                print(f"⚠️ Cached prompt failed, falling back to ref_audio: {e}")

        # Standard path: write ref audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as ref_tmp:
            ref_tmp.write(ref_audio_bytes)
            ref_path = ref_tmp.name

        try:
            audio = self.model.generate(
                text=text,
                ref_audio=ref_path,
                language=language,
                num_step=32,
                speed=speed,
            )

            output = io.BytesIO()
            audio_data = audio[0] if isinstance(audio, list) else audio
            sf.write(output, audio_data, 24000, format="WAV")
            return output.getvalue()

        finally:
            try:
                os.unlink(ref_path)
            except OSError:
                pass

    @modal.method()
    def cache_voice_prompt(self, voice_id: str, ref_audio_bytes: bytes) -> bool:
        """Run Whisper ASR once and save the cached prompt to Modal Volume.

        WHY: Custom voices created in the Voice Library need their Whisper
        prompt computed once. This saves the result as a .pt file so future
        generate() calls with cached_voice=voice_id skip Whisper entirely.

        Returns True on success, False on failure.
        """
        import torch

        # Ensure the custom prompts directory exists
        os.makedirs(CUSTOM_PROMPTS_DIR, exist_ok=True)

        pt_path = os.path.join(CUSTOM_PROMPTS_DIR, f"{voice_id}.pt")

        # Write ref audio to a temp file for the model
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as ref_tmp:
            ref_tmp.write(ref_audio_bytes)
            ref_path = ref_tmp.name

        try:
            print(f"⏳ Computing voice prompt for custom voice '{voice_id}'...")
            prompt = self.model.create_voice_clone_prompt(ref_audio=ref_path)
            torch.save(prompt, pt_path)
            # Commit the volume so other containers can see the new .pt file
            preset_volume.commit()
            print(f"✅ Cached custom voice prompt to {pt_path}")
            return True
        except Exception as e:
            print(f"⚠️ Failed to cache voice prompt for '{voice_id}': {e}")
            return False
        finally:
            try:
                os.unlink(ref_path)
            except OSError:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# 3. Web Endpoint (Separate CPU container → .remote() to GPU class)
# ─────────────────────────────────────────────────────────────────────────────
# WHY separate function (not a method on OmniVoiceModel):
#   GPU memory snapshots only restore properly via .remote() calls.
#   When @modal.fastapi_endpoint is placed directly on @app.cls, the snapshot
#   is NOT used — causing 50-60s cold starts instead of ~4s.
#   The CPU container cost (~$0.0003/request) is negligible.

@app.function(image=image, timeout=300)
@modal.fastapi_endpoint(method="POST")
async def clone_api(request: Request):
    """HTTP POST endpoint for voice cloning.

    Expects JSON: { text, ref_audio_b64?, language?, speed?, cached_voice? }
    When cached_voice is provided, ref_audio_b64 can be empty — the GPU
    will use the pre-computed .pt prompt from the Modal Volume.
    Returns: audio/wav bytes
    """
    try:
        _verify_modal_secret(request)
        payload = await request.json()
        text = payload.get("text")
        ref_b64 = payload.get("ref_audio_b64", "")
        language = payload.get("language", "en")
        speed = float(payload.get("speed", 1.0))
        cached_voice = payload.get("cached_voice", "")

        # DEBUG: Log what values were received
        print(f"[clone_api] text='{text[:50] if text else ''}', cached_voice='{cached_voice}', ref_b64_len={len(ref_b64) if ref_b64 else 0}")

        if not text:
            raise HTTPException(status_code=400, detail="Missing text")

        # Require either reference audio OR a cached voice name
        if not ref_b64 and not cached_voice:
            raise HTTPException(
                status_code=400,
                detail="Provide ref_audio_b64 or cached_voice",
            )

        # Decode ref audio (empty bytes if skipping R2 for cached voices)
        ref_bytes = b""
        if ref_b64:
            try:
                ref_bytes = base64.b64decode(ref_b64)
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid base64 audio data",
                )

        model = OmniVoiceModel()
        cloned_wav_bytes = model.generate.remote(text, ref_bytes, language, speed, cached_voice)

        return Response(content=cloned_wav_bytes, media_type="audio/wav")

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# 4. Cache Voice Prompt Endpoint
# ─────────────────────────────────────────────────────────────────────────────
# WHY: When a user creates a custom voice in the Voice Library, the API
# calls this endpoint to pre-compute the Whisper ASR prompt and save it
# as a .pt file on the Modal Volume. Future TTS requests for this voice
# load the .pt file instantly — skipping 8-12s of Whisper per request.

@app.function(image=image, timeout=120)
@modal.fastapi_endpoint(method="POST")
async def cache_voice_api(request: Request):
    """Pre-compute and cache a voice prompt on the Modal Volume.

    Expects JSON: { voice_id, ref_audio_b64 }
    Runs Whisper ASR once, saves the resulting PyTorch tensor as
    /preset-voices/custom/{voice_id}.pt for future generate() calls.
    """
    try:
        _verify_modal_secret(request)
        payload = await request.json()
        voice_id = payload.get("voice_id")
        ref_b64 = payload.get("ref_audio_b64")

        if not voice_id or not ref_b64:
            raise HTTPException(
                status_code=400,
                detail="Missing voice_id or ref_audio_b64",
            )

        try:
            ref_bytes = base64.b64decode(ref_b64)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid base64 audio data",
            )

        model = OmniVoiceModel()
        success = model.cache_voice_prompt.remote(str(voice_id).lower(), ref_bytes)

        return {"cached": success, "voice_id": voice_id}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Cache voice error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# 5. Health Check
# ─────────────────────────────────────────────────────────────────────────────

@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
async def health_api():
    """Health check — verifies endpoint is reachable."""
    return {
        "status": "ok",
        "model": "k2-fsa/OmniVoice",
        "gpu": "L4",
        "snapshot_key": SNAPSHOT_KEY,
        "optimizations": [
            "gpu_memory_snapshot",
            "warmup_pass",
            "volume_weights",
            "speed_param",
            "language_param",
            "volume_prompt_cache",
            "custom_voice_cache",
        ],
    }
