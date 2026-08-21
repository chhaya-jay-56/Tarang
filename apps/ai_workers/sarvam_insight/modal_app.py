# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Self-hosted Sarvam-30B FP8 (MoE, 2.4B active params) on Modal for
# VoiceInsight call intelligence extraction. Replaces the unreliable
# Qwen 35B proxy endpoint that was returning 503s.
#
# MODEL: sarvamai/sarvam-30b-fp8
#   - 30B total params, 2.4B active (128 experts, top-6 routing)
#   - FP8 E4M3 quantized via NVIDIA ModelOpt (~32GB weights)
#   - SOTA on 22 Indian languages including Gujarati
#   - Apache License — full commercial use
#
# ARCHITECTURE:
#   vLLM 0.15.0 + hotpatch (sarvam_moe is a custom arch not yet in
#   mainline vLLM). The hotpatch_vllm.py script from HuggingFace patches
#   the vLLM registry and downloads the custom model executor.
#
# GPU: L40S (48GB VRAM)
#   - FP8 weights ~32GB + KV cache fits in 48GB
#   - Single GPU, no tensor parallelism needed
#
# CRITICAL ENV VAR:
#   VLLM_USE_FLASHINFER_MOE_FP8=0 — without this, vLLM gets stuck
#   during FlashInfer MoE FP8 kernel compilation and crashes.
#
# DEPLOY: modal deploy apps/ai_workers/sarvam_insight/modal_app.py
# TEST:   modal serve apps/ai_workers/sarvam_insight/modal_app.py
# ─────────────────────────────────────────────────────────────────────────────

import os
import subprocess
import modal
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse


# ─────────────────────────────────────────────────────────────────────────────
# 1. Image & Environment
# ─────────────────────────────────────────────────────────────────────────────

MODEL_ID = "sarvamai/sarvam-30b-fp8"
MODEL_DIR = "/model-cache"
VLLM_PORT = 8000

def _download_model():
    """Pre-download model weights into the image layer (baked into snapshot)."""
    from huggingface_hub import snapshot_download
    snapshot_download(
        MODEL_ID,
        local_dir=MODEL_DIR,
        ignore_patterns=["*.md", "*.txt", "LICENSE*"],
    )

def _hotpatch_vllm():
    """Run Sarvam's hotpatch to register the custom sarvam_moe architecture."""
    import urllib.request
    import importlib
    from pathlib import Path

    # Find vLLM install dir
    import vllm
    vllm_dir = Path(vllm.__file__).resolve().parent
    registry_path = vllm_dir / "model_executor" / "models" / "registry.py"
    sarvam_path = vllm_dir / "model_executor" / "models" / "sarvam.py"

    # 1. Patch registry.py to add Sarvam model entries
    if registry_path.exists():
        text = registry_path.read_text(encoding="utf-8")
        if '"SarvamMoEForCausalLM"' not in text:
            lines = text.splitlines(keepends=True)
            new_entries = [
                '    "SarvamMoEForCausalLM": ("sarvam", "SarvamMoEForCausalLM"),\n',
                '    "SarvamMLAForCausalLM": ("sarvam", "SarvamMLAForCausalLM"),\n',
            ]
            # Find closing brace of _TEXT_GENERATION_MODELS dict
            start_idx = None
            for i, line in enumerate(lines):
                if line.strip() == "_TEXT_GENERATION_MODELS = {":
                    start_idx = i
                    break
            if start_idx is not None:
                depth = 0
                end_idx = None
                for j in range(start_idx, len(lines)):
                    depth += lines[j].count("{")
                    depth -= lines[j].count("}")
                    if j > start_idx and depth == 0:
                        end_idx = j
                        break
                if end_idx is not None:
                    lines[end_idx:end_idx] = new_entries
                    registry_path.write_text("".join(lines), encoding="utf-8")
                    print(f"✅ Patched registry.py at {registry_path}")

    # 2. Download sarvam.py model executor from HuggingFace
    raw_url = "https://huggingface.co/sarvamai/sarvam-30b/raw/main/sarvam.py"
    print(f"Downloading sarvam.py from: {raw_url}")
    req = urllib.request.Request(raw_url, headers={"User-Agent": "tarang-modal-build"})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
    sarvam_path.parent.mkdir(parents=True, exist_ok=True)
    sarvam_path.write_bytes(data)
    print(f"✅ Wrote sarvam.py to {sarvam_path}")


image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm==0.15.0",
        "huggingface_hub",
        "fastapi",
        "transformers",
    )
    .run_function(_hotpatch_vllm)  # Patch vLLM registry before model download
    .run_function(_download_model)  # Pre-download weights into image
    .env({
        # CRITICAL: Without this, vLLM hangs during FlashInfer MoE FP8
        # kernel compilation and the container crashes.
        "VLLM_USE_FLASHINFER_MOE_FP8": "0",
    })
)

app = modal.App("tarang-sarvam-insight", image=image)


def _verify_modal_secret(request: Request) -> None:
    """Verify the shared secret header for endpoint authentication."""
    expected = os.environ.get("MODAL_SHARED_SECRET")
    if expected and request.headers.get("x-tarang-modal-secret") != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


# ─────────────────────────────────────────────────────────────────────────────
# 2. vLLM Server Class — L40S GPU
# ─────────────────────────────────────────────────────────────────────────────
# WHY L40S:
#   Sarvam-30B FP8 weights are ~32GB. L40S has 48GB VRAM, leaving ~16GB
#   for KV cache and vLLM overhead. Single GPU, no tensor parallelism.
#
# WHY scaledown_window=120:
#   vLLM cold starts are expensive (~30-60s for model loading). 2 min
#   warm window keeps the container alive across typical request gaps.

@app.cls(
    gpu="L40S",
    cpu=4.0,
    memory=1024 * 32,  # 32 GB system RAM
    timeout=600,       # 10 min ceiling for long transcripts
    min_containers=0,  # True serverless ($0 when idle)
    scaledown_window=120,  # 2 min warm window
)
class SarvamInsightModel:
    @modal.enter()
    def start_vllm_server(self):
        """Start vLLM as a background process serving OpenAI-compatible API."""
        import time
        import httpx

        self.vllm_process = subprocess.Popen(
            [
                "python", "-m", "vllm.entrypoints.openai.api_server",
                "--model", MODEL_DIR,
                "--trust-remote-code",
                "--quantization", "modelopt",
                "--kv-cache-dtype", "fp8",
                "--max-model-len", "8192",
                "--gpu-memory-utilization", "0.90",
                "--port", str(VLLM_PORT),
                "--host", "0.0.0.0",
            ],
            env={
                **os.environ,
                "VLLM_USE_FLASHINFER_MOE_FP8": "0",
            },
        )

        # Wait for vLLM server to become healthy
        health_url = f"http://localhost:{VLLM_PORT}/health"
        for attempt in range(120):  # 120 * 1s = 2 min max
            try:
                resp = httpx.get(health_url, timeout=2.0)
                if resp.status_code == 200:
                    print(f"✅ vLLM server healthy after {attempt + 1}s")
                    return
            except Exception:
                pass
            time.sleep(1)

        raise RuntimeError("vLLM server failed to start within 120s")

    @modal.method()
    def analyze(self, messages: list[dict], temperature: float = 0.1, max_tokens: int = 4096) -> str:
        """Forward a chat completion request to the local vLLM server."""
        import httpx

        body = {
            "model": MODEL_DIR,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        with httpx.Client(timeout=300.0) as client:
            resp = client.post(
                f"http://localhost:{VLLM_PORT}/v1/chat/completions",
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]


# ─────────────────────────────────────────────────────────────────────────────
# 3. Web Endpoint (CPU container → .remote() to GPU class)
# ─────────────────────────────────────────────────────────────────────────────
# WHY separate function: Same pattern as OmniVoice. The CPU container
# handles HTTP routing and auth; the GPU class handles inference.
# Cost: ~$0.0003/request for the CPU container, negligible.

@app.function(image=image, timeout=600)
@modal.fastapi_endpoint(method="POST")
async def analyze_api(request: Request):
    """HTTP POST endpoint for call transcript intelligence extraction.

    Expects JSON: {
        messages: [{role: str, content: str}, ...],
        temperature?: float,
        max_tokens?: int,
    }
    Returns: { content: str }
    """
    try:
        _verify_modal_secret(request)
        payload = await request.json()
        messages = payload.get("messages", [])
        temperature = float(payload.get("temperature", 0.1))
        max_tokens = int(payload.get("max_tokens", 4096))

        if not messages:
            raise HTTPException(status_code=400, detail="Missing messages")

        model = SarvamInsightModel()
        content = model.analyze.remote(messages, temperature, max_tokens)

        return JSONResponse(content={"content": content})

    except HTTPException:
        raise
    except Exception as e:
        print(f"Analyze error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# 4. Health Check
# ─────────────────────────────────────────────────────────────────────────────

@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
async def health_api():
    """Health check — verifies endpoint is reachable."""
    return {
        "status": "ok",
        "model": MODEL_ID,
        "gpu": "L40S",
        "precision": "FP8 (E4M3)",
        "architecture": "sarvam_moe (128 experts, top-6, 2.4B active)",
        "serving": "vLLM 0.15.0 + hotpatch",
        "purpose": "VoiceInsight call intelligence extraction",
    }
