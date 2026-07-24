from pydantic import BaseModel, Field
from typing import Optional


class TTSParams(BaseModel):
    """Inference parameters injectable by the user at generation time."""
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    top_k: int = Field(default=50, ge=1, le=500)
    max_new_tokens: int = Field(default=2048, ge=64, le=8192)
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    guidance_scale: float = Field(default=1.0, ge=0.0, le=5.0)


# ── Requests ──

class TTSGenerateRequest(BaseModel):
    """Generate speech from text using a saved voice."""
    text: str
    voice_id: str                          # saved_voice UUID
    language: str = "en"
    instruction: str = ""                  # NL style instruction
    params: TTSParams = TTSParams()


class TTSCloneRequest(BaseModel):
    """Clone a voice using Qwen3-TTS (text + reference audio)."""
    text: str
    ref_audio_b64: str                     # base64-encoded reference audio
    language: str = "en"
    instruction: str = ""
    params: TTSParams = TTSParams()


class TTSPVCRequest(BaseModel):
    """Post Voice Conversion using Qwen3-TTS."""
    source_audio_b64: str                  # audio to convert
    ref_audio_b64: str                     # target voice reference
    language: str = "en"
    params: TTSParams = TTSParams()


# ── Responses ──

class TTSGenerateResponse(BaseModel):
    """Response from TTS generation."""
    audio_url: str
    duration_ms: Optional[int] = None
    r2_key: str


# ── Qwen3-TTS supported languages ──

QWEN3_TTS_LANGUAGES = [
    {"id": "en", "name": "English"},
    {"id": "zh", "name": "Chinese"},
    {"id": "ja", "name": "Japanese"},
    {"id": "ko", "name": "Korean"},
    {"id": "de", "name": "German"},
    {"id": "fr", "name": "French"},
    {"id": "ru", "name": "Russian"},
    {"id": "pt", "name": "Portuguese"},
    {"id": "es", "name": "Spanish"},
    {"id": "it", "name": "Italian"},
]
