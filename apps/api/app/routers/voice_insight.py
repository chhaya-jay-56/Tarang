import logging
import uuid
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.dependencies import get_db, get_current_user
from app.database import AsyncSessionLocal
from app.models.call_analysis import CallAnalysis, AnalysisStatus
from app.schemas.voice_insight import (
    CallAnalysisCreate,
    CallAnalysisResponse,
    CallAnalysisDetailResponse,
    CallAnalysisListResponse,
)
from app.services import clone_service
from app.services.voice_insight_service import (
    start_gladia_transcription,
    upload_audio_to_gladia,
    get_gladia_transcription,
)
from app.services.storage import upload_file as upload_to_r2, get_download_presigned_url
from app.exceptions import ExternalServiceError
from app.config import settings

logger = logging.getLogger("tarang.voice_insight")

router = APIRouter(
    prefix="/api/v1/voice-insight",
    tags=["voice-insight"],
)


# ─────────────────────────────────────────────────────────────────────────────
# Background Intelligence Extraction (Qwen via OpenAI-compatible proxy)
# ─────────────────────────────────────────────────────────────────────────────

async def _run_qwen_extraction(call_id: uuid.UUID, transcript_data: dict):
    """Background task: sends transcript to Qwen proxy, writes intelligence to DB."""
    import httpx

    # Extract utterances from Gladia V2 structure
    res_obj = transcript_data.get("result", transcript_data.get("prediction", transcript_data))
    utterances = (
        res_obj.get("utterances")
        or (res_obj.get("transcription", {}).get("utterances") if isinstance(res_obj.get("transcription"), dict) else None)
        or []
    )

    if not utterances:
        if isinstance(res_obj.get("transcription"), str):
            conversation_text = res_obj["transcription"]
        elif isinstance(res_obj.get("full_transcript"), str):
            conversation_text = res_obj["full_transcript"]
        else:
            conversation_text = str(res_obj)
    else:
        lines = []
        for utt in utterances:
            speaker = f"Speaker {utt.get('speaker', 'Unknown')}"
            lines.append(f"{speaker}: {utt.get('text', '')}")
        conversation_text = "\n".join(lines)

    prompt = (
        "You are an AI intelligence analyst for the Police of Ahmedabad.\n"
        "Analyze the following call recording transcript (which may be in English, Hindi, or Gujarati).\n\n"
        f"Transcript:\n{conversation_text}\n\n"
        "Extract the following information in strict JSON format:\n"
        "{\n"
        '  "threat_level": "LOW|MEDIUM|HIGH|CRITICAL",\n'
        '  "primary_language": "The main language spoken",\n'
        '  "summary": "A 2-3 sentence summary of the conversation",\n'
        '  "actionable_intelligence": ["Point 1", "Point 2"],\n'
        '  "suspicious_keywords": ["word1", "word2"],\n'
        '  "named_entities": ["person/place/org names found"],\n'
        '  "topics": ["topic1", "topic2"],\n'
        '  "overall_sentiment": "Angry|Calm|Urgent|Stressed|Neutral",\n'
        '  "emotion_breakdown": {"anger": 0.0, "urgency": 0.0, "stress": 0.0, "calm": 0.0}\n'
        "}\n\n"
        "Output only the JSON block without any markdown formatting."
    )

    intelligence_json = {}
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            headers = {
                "Authorization": f"Bearer {settings.MODAL_PROXY_TOKEN_ID}.{settings.MODAL_PROXY_TOKEN_SECRET}",
                "Content-Type": "application/json",
            }
            body = {
                "model": "Qwen/Qwen3.6-35B-A3B",
                "messages": [
                    {"role": "system", "content": "You are a concise technical assistant."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.1,
                "max_tokens": 1024,
                "stream": False,
                "extra_body": {"reasoning_effort": "none"},
            }
            resp = await client.post(settings.MODAL_QWEN_ENDPOINT, headers=headers, json=body)
            resp.raise_for_status()

            response_data = resp.json()
            response_text = response_data["choices"][0]["message"]["content"].strip()

            # Strip markdown fences if model adds them
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            intelligence_json = json.loads(response_text)
    except json.JSONDecodeError:
        logger.error("Qwen returned non-JSON: %s", response_text[:200] if 'response_text' in locals() else "N/A")
        intelligence_json = {"error": "Non-JSON response from LLM"}
    except Exception as e:
        logger.error("Failed to extract intelligence from Qwen: %s", e, exc_info=True)
        intelligence_json = {"error": str(e)}

    # Write result back using a fresh session
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(CallAnalysis).where(CallAnalysis.id == call_id))
        call = result.scalar_one_or_none()
        if call:
            call.intelligence = intelligence_json
            call.status = (
                AnalysisStatus.COMPLETED if "error" not in intelligence_json
                else AnalysisStatus.FAILED
            )
            await db.commit()
            logger.info("Intelligence extraction complete for call %s → %s", call_id, call.status)


async def _poll_gladia_and_extract_intelligence(call_id: uuid.UUID, gladia_job_id: str):
    """Background task: Polls Gladia V2 until job status is 'done', then invokes Qwen extraction."""
    import asyncio

    max_attempts = 40  # 40 * 3s = 120 seconds max
    for attempt in range(max_attempts):
        await asyncio.sleep(3)
        try:
            gladia_res = await get_gladia_transcription(gladia_job_id)
            status = gladia_res.get("status")
            logger.info("Polling Gladia job %s (attempt %d/%d): status=%s", gladia_job_id, attempt + 1, max_attempts, status)

            if status == "done":
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(CallAnalysis).where(CallAnalysis.id == call_id))
                    call = result.scalar_one_or_none()
                    if call:
                        call.transcript = gladia_res
                        call.status = AnalysisStatus.EXTRACTING

                        # Extract audio duration if present
                        res_obj = gladia_res.get("result", gladia_res)
                        meta = res_obj.get("metadata", {}) if isinstance(res_obj, dict) else {}
                        if meta.get("audio_duration"):
                            call.duration_seconds = float(meta["audio_duration"])

                        await db.commit()

                # Trigger Qwen extraction immediately
                await _run_qwen_extraction(call_id, gladia_res)
                return

            elif status == "error":
                logger.error("Gladia job %s failed with status=error: %s", gladia_job_id, gladia_res)
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(CallAnalysis).where(CallAnalysis.id == call_id))
                    call = result.scalar_one_or_none()
                    if call:
                        call.status = AnalysisStatus.FAILED
                        await db.commit()
                return
        except Exception as e:
            logger.warning("Error polling Gladia job %s (attempt %d): %s", gladia_job_id, attempt + 1, e)

    # If timed out
    logger.error("Gladia polling timed out after %d attempts for call %s", max_attempts, call_id)
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(CallAnalysis).where(CallAnalysis.id == call_id))
        call = result.scalar_one_or_none()
        if call:
            call.status = AnalysisStatus.FAILED
            await db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/upload-audio")
async def upload_audio_to_r2(
    file: UploadFile = File(...),
    clerk_user_id: str = Depends(get_current_user),
):
    """Upload an audio recording file directly to Cloudflare R2 and Gladia."""
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file provided")

    # 1. Store in Cloudflare R2 for permanent archive
    r2_key = f"voice_insight/{uuid.uuid4()}_{file.filename}"
    upload_to_r2(file_bytes, r2_key)

    # 2. Upload directly to Gladia API to ensure 100% accessible transcription URL
    try:
        gladia_audio_url = await upload_audio_to_gladia(file_bytes, file.filename)
    except Exception as e:
        logger.warning("Gladia direct upload failed, falling back to R2 presigned URL: %s", e)
        gladia_audio_url = get_download_presigned_url(r2_key, expiration=86400)

    return {"r2_key": r2_key, "audio_url": gladia_audio_url, "filename": file.filename}


@router.post("/analyze", response_model=CallAnalysisResponse)
async def analyze_call(
    body: CallAnalysisCreate,
    background_tasks: BackgroundTasks,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start analyzing a call recording via Gladia → Qwen pipeline."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        gladia_response = await start_gladia_transcription(str(body.audio_url))
        gladia_job_id = gladia_response.get("id")
    except ExternalServiceError as e:
        logger.error("Gladia service error: %s", e.message)
        raise HTTPException(status_code=502, detail=e.message)
    except Exception as e:
        logger.error("Failed to start Gladia job: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

    call = CallAnalysis(
        user_id=user_id,
        filename=body.filename,
        audio_url=str(body.audio_url),
        status=AnalysisStatus.TRANSCRIBING,
        gladia_job_id=gladia_job_id,
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)

    # Add background task to poll Gladia and trigger Qwen automatically
    background_tasks.add_task(_poll_gladia_and_extract_intelligence, call.id, gladia_job_id)

    return call


@router.post("/webhook")
async def gladia_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Webhook called by Gladia when transcription is complete (optional fallback)."""
    import httpx

    payload = await request.json()
    job_id = payload.get("id")
    event = payload.get("event")

    if not job_id:
        return {"status": "ignored"}

    result = await db.execute(
        select(CallAnalysis).where(CallAnalysis.gladia_job_id == job_id)
    )
    call = result.scalar_one_or_none()

    if not call:
        logger.warning("Webhook received for unknown Gladia job %s", job_id)
        return {"status": "not_found"}

    if event == "success":
        result_url = payload.get("result_url")
        async with httpx.AsyncClient() as client:
            headers = {"x-gladia-key": settings.GLADIA_API_KEY}
            resp = await client.get(result_url, headers=headers)
            resp.raise_for_status()
            transcript_data = resp.json()

        call.transcript = transcript_data
        call.status = AnalysisStatus.EXTRACTING

        metadata = transcript_data.get("metadata", {})
        if metadata.get("audio_duration"):
            call.duration_seconds = float(metadata["audio_duration"])

        await db.commit()
        background_tasks.add_task(_run_qwen_extraction, call.id, transcript_data)

    elif event == "error":
        call.status = AnalysisStatus.FAILED
        await db.commit()

    return {"status": "received"}


@router.get("/calls", response_model=CallAnalysisListResponse)
async def list_calls(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    q: str = Query(None, description="Search query"),
    status: str = Query(None, description="Filter by status"),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List and search call analysis records for the current user."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    offset = (page - 1) * per_page
    query = select(CallAnalysis).where(CallAnalysis.user_id == user_id)

    if q:
        query = query.where(CallAnalysis.filename.ilike(f"%{q}%"))

    if status:
        query = query.where(CallAnalysis.status == status)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    # Paginate
    query = query.order_by(CallAnalysis.created_at.desc()).offset(offset).limit(per_page)
    calls = (await db.execute(query)).scalars().all()

    return {"items": calls, "total": total}


@router.get("/calls/{call_id}", response_model=CallAnalysisDetailResponse)
async def get_call_detail(
    call_id: uuid.UUID,
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get details for a specific call analysis."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(CallAnalysis).where(
            CallAnalysis.id == call_id,
            CallAnalysis.user_id == user_id,
        )
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call analysis not found")
    return call


@router.get("/calls/{call_id}/export")
async def export_call(
    call_id: uuid.UUID,
    format: str = Query("json", description="Export format: json or csv"),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export a call analysis as JSON or CSV."""
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(CallAnalysis).where(
            CallAnalysis.id == call_id,
            CallAnalysis.user_id == user_id,
        )
    )
    call = result.scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call analysis not found")

    export_data = {
        "case_id": str(call.id),
        "filename": call.filename,
        "status": call.status.value if call.status else None,
        "audio_url": call.audio_url,
        "duration_seconds": call.duration_seconds,
        "created_at": call.created_at.isoformat() if call.created_at else None,
        "intelligence": call.intelligence,
        "transcript_text": None,
    }

    # Flatten transcript into plain text
    if call.transcript:
        res_obj = call.transcript.get("result", call.transcript.get("prediction", call.transcript))
        utterances = res_obj.get("utterances") or []
        if utterances:
            lines = [f"Speaker {u.get('speaker','?')}: {u.get('text','')}" for u in utterances]
            export_data["transcript_text"] = "\n".join(lines)
        else:
            export_data["transcript_text"] = str(res_obj.get("transcription", ""))

    if format == "csv":
        import csv
        import io
        from fastapi.responses import StreamingResponse

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(export_data.keys())
        writer.writerow([
            v if not isinstance(v, dict) else json.dumps(v) for v in export_data.values()
        ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={call.filename or call_id}.csv"},
        )

    return JSONResponse(
        content=export_data,
        headers={"Content-Disposition": f"attachment; filename={call.filename or call_id}.json"},
    )


@router.get("/analytics")
async def get_analytics(
    days: int = Query(30, ge=1, le=365, description="Lookback period in days"),
    clerk_user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Analytics dashboard data: threat distribution, sentiment breakdown,
    keyword frequency, calls-over-time, and emotion heatmap data.
    """
    try:
        user_id = await clone_service.resolve_user_id(db, clerk_user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Fetch all completed calls in the window
    result = await db.execute(
        select(CallAnalysis).where(
            CallAnalysis.user_id == user_id,
            CallAnalysis.status == AnalysisStatus.COMPLETED,
            CallAnalysis.created_at >= since,
        )
    )
    calls = result.scalars().all()

    # Aggregate analytics
    total_calls = len(calls)
    threat_distribution = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    sentiment_distribution: dict[str, int] = {}
    keyword_frequency: dict[str, int] = {}
    calls_over_time: dict[str, int] = {}
    emotion_heatmap: dict[str, float] = {"anger": 0.0, "urgency": 0.0, "stress": 0.0, "calm": 0.0}
    languages: dict[str, int] = {}
    total_duration = 0.0

    for call in calls:
        intel = call.intelligence or {}

        # Threat
        threat = intel.get("threat_level", "LOW").upper()
        if threat in threat_distribution:
            threat_distribution[threat] += 1

        # Sentiment
        sentiment = intel.get("overall_sentiment", "Unknown")
        sentiment_distribution[sentiment] = sentiment_distribution.get(sentiment, 0) + 1

        # Keywords
        for kw in intel.get("suspicious_keywords", []):
            kw_lower = kw.lower()
            keyword_frequency[kw_lower] = keyword_frequency.get(kw_lower, 0) + 1

        # Timeline (group by date)
        if call.created_at:
            date_key = call.created_at.strftime("%Y-%m-%d")
            calls_over_time[date_key] = calls_over_time.get(date_key, 0) + 1

        # Emotion heatmap
        emotions = intel.get("emotion_breakdown", {})
        for emo_key in emotion_heatmap:
            val = emotions.get(emo_key, 0.0)
            try:
                emotion_heatmap[emo_key] += float(val)
            except (TypeError, ValueError):
                pass

        # Language
        lang = intel.get("primary_language", "Unknown")
        languages[lang] = languages.get(lang, 0) + 1

        # Duration
        if call.duration_seconds:
            total_duration += call.duration_seconds

    # Average emotions
    if total_calls > 0:
        for k in emotion_heatmap:
            emotion_heatmap[k] = round(emotion_heatmap[k] / total_calls, 2)

    # Sort keywords by frequency (top 20)
    top_keywords = sorted(keyword_frequency.items(), key=lambda x: x[1], reverse=True)[:20]

    # Sort timeline
    sorted_timeline = sorted(calls_over_time.items())

    return {
        "period_days": days,
        "total_calls": total_calls,
        "total_duration_minutes": round(total_duration / 60, 1),
        "threat_distribution": threat_distribution,
        "sentiment_distribution": sentiment_distribution,
        "top_keywords": [{"keyword": k, "count": v} for k, v in top_keywords],
        "calls_over_time": [{"date": d, "count": c} for d, c in sorted_timeline],
        "emotion_heatmap": emotion_heatmap,
        "language_distribution": languages,
    }
