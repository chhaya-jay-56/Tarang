import base64
import io
import modal
from fastapi import Request, HTTPException
from fastapi.responses import Response

# ---------------------------------------------------------
# 1. Image & Environment Definition
# ---------------------------------------------------------
# Define the environment. This builds a Docker container in the cloud.
# We install system packages (like ffmpeg) and Python libraries.
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg")
    .pip_install(
        "torch",
        "torchaudio",
        "transformers",
        "fastapi"
        # Add your specific AI model libraries here:
        # "omnivoice", 
    )
    # You can also run setup functions to download model weights securely during build
    # .run_function(download_model_weights) 
)

# Initialize the Modal App
app = modal.App("tarang-omnivoice", image=image)


# ---------------------------------------------------------
# 2. Model Class (GPU / CPU Configuration)
# ---------------------------------------------------------
# Using modal.cls allows us to load the model into memory ONCE
# and keep it warm for subsequent requests (container reuse).
@app.cls(
    gpu=modal.gpu.A10G(),               # Choose GPU: T4(), A10G(), A100()
    cpu=2.0,                            # Allocate CPU cores
    memory=1024 * 8,                    # 8 GB RAM
    timeout=300,                        # Max execution time (5 minutes)
    keep_warm=2,                        # Keep 1 container running to avoid cold starts
    container_idle_timeout=2       # Spin down container after 5 mins of inactivity
)
class OmniVoiceModel:
    @modal.enter()
    def load_model(self):
        """
        Runs ONCE when the container spins up.
        Load your heavy AI models into GPU memory here.
        """
        print("Loading OmniVoice Model into memory...")
        # self.model = load_my_ai_model()
        pass

    @modal.method()
    def generate(self, text: str, ref_audio_bytes: bytes, language: str) -> bytes:
        """
        The actual inference function.
        """
        print(f"Generating audio for text: {text} in {language}")
        
        # 1. Process Reference Audio
        # 2. Run Inference using self.model
        # 3. Return WAV bytes
        
        # MOCK IMPLEMENTATION (Replace with your actual AI code)
        import wave
        output = io.BytesIO()
        with wave.open(output, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(24000)
            wf.writeframes(b"\x00\x00" * 24000)  # 1 second of silence
        
        return output.getvalue()


# ---------------------------------------------------------
# 3. Web Endpoint (What your API calls)
# ---------------------------------------------------------
@app.function(
    image=image,
    timeout=300
)
@modal.web_endpoint(method="POST")
async def clone_api(request: Request):
    """
    HTTP POST endpoint that your `clone_service.py` targets.
    """
    try:
        # 1. Parse incoming JSON
        payload = await request.json()
        text = payload.get("text")
        ref_b64 = payload.get("ref_audio_b64")
        language = payload.get("language", "en")

        if not text or not ref_b64:
            raise HTTPException(status_code=400, detail="Missing text or reference audio")

        # 2. Decode Audio
        try:
            ref_bytes = base64.b64decode(ref_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 audio data")

        # 3. Call the Model on the GPU
        model = OmniVoiceModel()
        cloned_wav_bytes = model.generate.remote(text, ref_bytes, language)

        # 4. Return Audio directly
        return Response(content=cloned_wav_bytes, media_type="audio/wav")

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
