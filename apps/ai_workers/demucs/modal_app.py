# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Modal GPU worker for Demucs (htdemucs) voice/instrumental separation.
# This is Phase 2 of the dubbing pipeline — separating vocals from
# background music/effects so Gladia transcribes clean speech.
#
# ARCHITECTURE:
#   1. API backend POSTs { audio_r2_key, job_id } to this endpoint
#   2. This worker downloads full_audio.wav from R2
#   3. Runs htdemucs separation on T4 GPU (~4GB VRAM, ~30s for 5 min audio)
#   4. Uploads vocals.wav + instrumental.wav back to R2
#   5. Returns { vocal_r2_key, instrumental_r2_key } as JSON
#
# WHY MODAL OVER REPLICATE:
#   - Full control over output format (exactly 2 stems, not 4)
#   - No custom Cog wrapper needed
#   - R2-to-R2 flow via Modal Secrets (no base64 bloat for large WAVs)
#   - T4 is cheapest GPU option, htdemucs only needs ~4GB of 16GB VRAM
#
# DEPLOY: modal deploy apps/ai_workers/demucs/modal_app.py
# TEST:   modal serve apps/ai_workers/demucs/modal_app.py
# ─────────────────────────────────────────────────────────────────────────────

import io
import os
import tempfile

import modal
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

# ---------------------------------------------------------
# 1. Image & Environment Definition
# ---------------------------------------------------------
# Builds a Docker container with all Demucs dependencies.
# torch + torchaudio for GPU inference, demucs for the model itself.
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "sox")
    .env({"PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"})
    .pip_install(
        "numpy<2",
        "torch==2.1.2",
        "torchaudio==2.1.2",
        "demucs",
        "boto3",
        "fastapi",
        "soundfile",
    )
)

# Initialize the Modal App
app = modal.App("tarang-demucs", image=image)


def _verify_modal_secret(request: Request) -> None:
    expected = os.environ.get("MODAL_SHARED_SECRET")
    if expected and request.headers.get("x-tarang-modal-secret") != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")

# R2 credentials injected via Modal Secrets dashboard
# Create with: modal secret create r2-credentials R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=...
r2_secret = modal.Secret.from_name("r2-credentials")


# ---------------------------------------------------------
# 2. R2 Helpers (runs inside Modal container)
# ---------------------------------------------------------
def _get_r2_client():
    """Create boto3 S3 client for Cloudflare R2 using Modal Secrets."""
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def _download_from_r2(r2_key: str, local_path: str):
    """Download a file from R2 to a local path."""
    s3 = _get_r2_client()
    bucket = os.environ["R2_BUCKET_NAME"]
    s3.download_file(bucket, r2_key, local_path)


def _upload_to_r2(local_path: str, r2_key: str, content_type: str = "audio/wav"):
    """Upload a local file to R2."""
    s3 = _get_r2_client()
    bucket = os.environ["R2_BUCKET_NAME"]
    s3.upload_file(
        local_path,
        bucket,
        r2_key,
        ExtraArgs={"ContentType": content_type},
    )


# ---------------------------------------------------------
# 3. Demucs Model Class (T4 GPU)
# ---------------------------------------------------------
@app.cls(
    gpu="T4",
    cpu=2.0,
    memory=1024 * 8,            # 8 GB RAM
    timeout=600,                 # 10 min max for long audio
    min_containers=0,            # True serverless (pay $0 when idle)
    scaledown_window=2,          # Matches omnivoice pattern
    secrets=[r2_secret],
)
class DemucsModel:
    @modal.enter()
    def load_model(self):
        """
        Runs ONCE when the container cold-starts.
        Downloads htdemucs weights and loads model to GPU.
        """
        import torch
        # pyrefly: ignore [missing-import]
        from demucs.pretrained import get_model

        print("Loading htdemucs model into GPU memory...")
        self.model = get_model("htdemucs")
        self.model.cuda()
        self.model.eval()
        self.device = torch.device("cuda")
        print(f"htdemucs loaded on {self.device} — ready for separation")

    @modal.method()
    def separate(self, audio_r2_key: str, job_id: str) -> dict:
        """
        Download audio from R2 → run Demucs → upload stems to R2.

        Returns dict with R2 keys for vocals and instrumental.

        Demucs htdemucs outputs 4 stems: drums, bass, other, vocals.
        We combine drums + bass + other → instrumental track.
        """
        import torch
        import torchaudio
        # pyrefly: ignore [missing-import]
        import soundfile as sf
        import numpy as np
        # pyrefly: ignore [missing-import]
        from demucs.apply import apply_model

        with tempfile.TemporaryDirectory() as tmpdir:
            # ── Step 1: Download source audio from R2 ──
            ext = os.path.splitext(audio_r2_key)[1].lower()
            if not ext:
                ext = ".wav"
            input_path = os.path.join(tmpdir, f"input{ext}")
            print(f"[demucs] Downloading {audio_r2_key} from R2...")
            _download_from_r2(audio_r2_key, input_path)

            # ── Step 2: Load audio ──
            print("[demucs] Loading audio for processing...")
            wav, sr = torchaudio.load(input_path)

            # Resample to model's expected sample rate if needed
            if sr != self.model.samplerate:
                print(f"[demucs] Resampling {sr}Hz → {self.model.samplerate}Hz")
                resampler = torchaudio.transforms.Resample(sr, self.model.samplerate)
                wav = resampler(wav)
                sr = self.model.samplerate

            # Ensure stereo (model expects 2 channels)
            if wav.shape[0] == 1:
                wav = wav.repeat(2, 1)
            elif wav.shape[0] > 2:
                wav = wav[:2]

            # ── Step 3: Run Demucs separation ──
            print("[demucs] Running htdemucs separation...")
            wav_gpu = wav.to(self.device)

            with torch.no_grad():
                # apply_model returns shape: [batch, sources, channels, samples]
                # sources order for htdemucs: drums(0), bass(1), other(2), vocals(3)
                sources = apply_model(
                    self.model,
                    wav_gpu[None],  # Add batch dimension
                    split=True,     # Process in segments (saves VRAM)
                    overlap=0.25,
                )[0]  # Remove batch dimension

            # ── Step 4: Extract vocals + combine instrumental ──
            vocals = sources[3].cpu().numpy()           # vocals stem
            instrumental = (
                sources[0] + sources[1] + sources[2]    # drums + bass + other
            ).cpu().numpy()

            print(f"[demucs] Separation complete — vocals: {vocals.shape}, instrumental: {instrumental.shape}")

            # ── Step 5: Save stems as WAV ──
            vocals_path = os.path.join(tmpdir, "vocals.wav")
            instrumental_path = os.path.join(tmpdir, "instrumental.wav")

            sf.write(vocals_path, vocals.T, sr, subtype="PCM_16")
            sf.write(instrumental_path, instrumental.T, sr, subtype="PCM_16")

            # ── Step 6: Upload to R2 ──
            vocal_r2_key = f"dub/{job_id}/vocals.wav"
            instrumental_r2_key = f"dub/{job_id}/instrumental.wav"

            print(f"[demucs] Uploading vocals → {vocal_r2_key}")
            _upload_to_r2(vocals_path, vocal_r2_key)

            print(f"[demucs] Uploading instrumental → {instrumental_r2_key}")
            _upload_to_r2(instrumental_path, instrumental_r2_key)

            # Get file sizes for logging
            vocals_size = os.path.getsize(vocals_path)
            instrumental_size = os.path.getsize(instrumental_path)

            print(f"[demucs] ✅ Done — vocals: {vocals_size/1024/1024:.1f}MB, instrumental: {instrumental_size/1024/1024:.1f}MB")

            return {
                "vocal_r2_key": vocal_r2_key,
                "instrumental_r2_key": instrumental_r2_key,
                "vocals_size_bytes": vocals_size,
                "instrumental_size_bytes": instrumental_size,
                "sample_rate": sr,
            }


# ---------------------------------------------------------
# 4. Web Endpoint (What the API backend calls)
# ---------------------------------------------------------
@app.function(
    image=image,
    timeout=600,
    secrets=[r2_secret],
)
@modal.fastapi_endpoint(method="POST")
async def separate_api(request: Request):
    """
    HTTP POST endpoint that demucs_service.py targets.

    Expects JSON:
    {
        "audio_r2_key": "dub/{job_id}/full_audio.wav",
        "job_id": "uuid-string"
    }

    Returns JSON:
    {
        "vocal_r2_key": "dub/{job_id}/vocals.wav",
        "instrumental_r2_key": "dub/{job_id}/instrumental.wav",
        "vocals_size_bytes": 12345678,
        "instrumental_size_bytes": 9876543,
        "sample_rate": 44100
    }
    """
    try:
        _verify_modal_secret(request)
        payload = await request.json()
        audio_r2_key = payload.get("audio_r2_key")
        job_id = payload.get("job_id")

        if not audio_r2_key or not job_id:
            raise HTTPException(
                status_code=400,
                detail="Missing required fields: audio_r2_key, job_id",
            )

        # Call the GPU model class
        model = DemucsModel()
        result = model.separate.remote(audio_r2_key, job_id)

        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[demucs] Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
