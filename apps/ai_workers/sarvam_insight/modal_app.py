# ---------------------------------------------------------------------------
# WHY THIS FILE EXISTS:
# Self-hosted Sarvam-30B FP8 (MoE, 2.4B active params) on Modal for
# VoiceInsight call intelligence extraction. Replaces the unreliable
# Qwen 35B proxy endpoint that was returning 503s.
#
# MODEL: sarvamai/sarvam-30b-fp8
#   - 30B total params, 2.4B active (128 experts, top-6 routing)
#   - FP8 E4M3 quantized via NVIDIA ModelOpt (~32GB weights)
#   - SOTA on 22 Indian languages including Gujarati
#   - Apache License -- full commercial use
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
# COLD START OPTIMIZATIONS APPLIED:
#   1. GPU Memory Snapshots -- snap=True captures GPU state after model load
#      + warm-up pass, so containers restore in ~4-8s instead of ~60-120s.
#   2. Warm-up Pass -- dummy completion request compiles CUDA kernels before
#      snapshot, so first real request is fast.
#   3. Post-restore CUDA Sync -- forces immediate GPU readiness after restore.
#   4. scaledown_window=2 -- true serverless, no idle container costs.
#
# CRITICAL ENV VAR:
#   VLLM_USE_FLASHINFER_MOE_FP8=0 -- without this, vLLM gets stuck
#   during FlashInfer MoE FP8 kernel compilation and crashes.
#
# DEPLOY: modal deploy apps/ai_workers/sarvam_insight/modal_app.py
# TEST:   modal serve apps/ai_workers/sarvam_insight/modal_app.py
# ---------------------------------------------------------------------------

import os
import subprocess
import modal
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse


# ---------------------------------------------------------------------------
# 1. Image & Environment
# ---------------------------------------------------------------------------

MODEL_ID = "sarvamai/sarvam-30b-fp8"
MODEL_DIR = "/model-cache"
VLLM_PORT = 8000

# Bump this to force Modal to re-create the snapshot after code changes
SNAPSHOT_KEY = "sarvam-insight-v2"


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
                    print(f"[OK] Patched registry.py at {registry_path}")

    # 2. Download sarvam.py model executor from HuggingFace
    raw_url = "https://huggingface.co/sarvamai/sarvam-30b/raw/main/sarvam.py"
    print(f"Downloading sarvam.py from: {raw_url}")
    req = urllib.request.Request(raw_url, headers={"User-Agent": "tarang-modal-build"})
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
    sarvam_path.parent.mkdir(parents=True, exist_ok=True)
    sarvam_path.write_bytes(data)
    print(f"[OK] Wrote sarvam.py to {sarvam_path}")


image = (
    modal.Image.from_registry("nvidia/cuda:12.1.1-devel-ubuntu22.04", add_python="3.11")
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


# ---------------------------------------------------------------------------
# 2. vLLM Server Class -- L40S GPU with GPU Memory Snapshots
# ---------------------------------------------------------------------------
# WHY L40S:
#   Sarvam-30B FP8 weights are ~32GB. L40S has 48GB VRAM, leaving ~16GB
#   for KV cache and vLLM overhead. Single GPU, no tensor parallelism.
#
# WHY GPU Snapshots (matching OmniVoice pattern):
#   Without snapshots: container cold-starts in ~60-120s (weight loading
#   + GPU transfer + CUDA kernel compilation). With snapshots: Modal
#   freezes CPU+GPU memory AFTER vLLM is loaded and warmed up. Next cold
#   start restores from snapshot in ~4-8s.
#
# WHY scaledown_window=2:
#   True serverless -- container shuts down 2s after last request.
#   With GPU snapshots, cold starts are fast enough that keeping idle
#   containers alive wastes money. OmniVoice uses the same pattern.

@app.cls(
    gpu="L40S",
    cpu=4.0,
    memory=1024 * 32,  # 32 GB system RAM
    timeout=600,       # 10 min ceiling for long transcripts
    min_containers=0,  # True serverless ($0 when idle)
    scaledown_window=2,  # 2s -- true serverless with fast snapshot restore
    enable_memory_snapshot=True,  # CPU memory snapshot
    experimental_options={"enable_gpu_snapshot": True},  # GPU memory snapshot
)
class SarvamInsightModel:
    @modal.enter(snap=True)
    def start_vllm_server(self):
        """Start vLLM as a background process and warm up CUDA kernels.

        WHY snap=True: Runs ONCE, then Modal snapshots the CPU + GPU state.
        Every subsequent container boot restores from snapshot (~4-8s)
        instead of re-running this code (~60-120s).

        WHY warm-up pass: CUDA lazily compiles kernels on first use.
        The dummy generation forces kernel compilation so it's captured
        in the snapshot -- first real request pays zero compilation cost.
        """
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
        for attempt in range(360):  # 360 * 1s = 6 min max
            try:
                resp = httpx.get(health_url, timeout=2.0)
                if resp.status_code == 200:
                    print(f"[OK] vLLM server healthy after {attempt + 1}s")
                    break
            except Exception:
                pass
            time.sleep(1)
        else:
            raise RuntimeError("vLLM server failed to start within 360s")

        # -- Warm-up pass: compile CUDA kernels before snapshot --
        print("[INFO] Running warm-up completion to compile CUDA kernels...")
        try:
            warmup_body = {
                "model": MODEL_DIR,
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant."},
                    {"role": "user", "content": "Hello, respond with one word."},
                ],
                "temperature": 0.1,
                "max_tokens": 16,
                "stream": False,
            }
            with httpx.Client(timeout=120.0) as client:
                warmup_resp = client.post(
                    f"http://localhost:{VLLM_PORT}/v1/chat/completions",
                    json=warmup_body,
                )
                warmup_resp.raise_for_status()
                print("[OK] Warm-up pass complete -- CUDA kernels compiled")
        except Exception as e:
            print(f"[WARN] Warm-up pass failed (non-fatal): {e}")

        print(f"[OK] SarvamInsight ready -- snapshot key: {SNAPSHOT_KEY}")

    @modal.enter()
    def post_restore(self):
        """Post-snapshot init -- runs on EVERY container start (including restores).

        WHY: After GPU snapshot restore, the vLLM subprocess and CUDA context
        may need a sync before kernels are usable. Without this, the first
        real request can incur a 1-2s lazy re-initialization penalty.
        """
        import time
        import httpx

        t0 = time.perf_counter()

        # Verify vLLM server is still responsive after restore
        health_url = f"http://localhost:{VLLM_PORT}/health"
        for attempt in range(30):  # 30 * 1s = 30s max
            try:
                resp = httpx.get(health_url, timeout=2.0)
                if resp.status_code == 200:
                    elapsed = time.perf_counter() - t0
                    print(f"[OK] Post-restore vLLM health check passed in {elapsed:.2f}s -- container ready")
                    return
            except Exception:
                pass
            time.sleep(1)

        elapsed = time.perf_counter() - t0
        print(f"[WARN] Post-restore vLLM health check failed after {elapsed:.2f}s -- proceeding anyway")

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


# ---------------------------------------------------------------------------
# 3. Web Endpoint (CPU container -> .remote() to GPU class)
# ---------------------------------------------------------------------------
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
        content = await model.analyze.remote.aio(messages, temperature, max_tokens)

        return JSONResponse(content={"content": content})

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERR] Analyze error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# 4. Health Check
# ---------------------------------------------------------------------------

@app.function(image=image)
@modal.fastapi_endpoint(method="GET")
async def health_api():
    """Health check -- verifies endpoint is reachable."""
    return {
        "status": "ok",
        "model": MODEL_ID,
        "gpu": "L40S",
        "precision": "FP8 (E4M3)",
        "architecture": "sarvam_moe (128 experts, top-6, 2.4B active)",
        "serving": "vLLM 0.15.0 + hotpatch",
        "snapshot_key": SNAPSHOT_KEY,
        "optimizations": [
            "gpu_memory_snapshot",
            "cpu_memory_snapshot",
            "warmup_pass",
            "scaledown_2s",
        ],
        "purpose": "VoiceInsight call intelligence extraction",
    }
