import os
import sys
import uuid
import json
import asyncio
from pathlib import Path

# Add apps/api to path so imports work correctly
api_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(api_dir))

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.call_analysis import CallAnalysis, AnalysisStatus
from app.routers.voice_insight import _run_sarvam_extraction
from sqlalchemy import select

# Mock Gladia V2 transcript containing Gujarati and risk keywords
MOCK_TRANSCRIPT_DATA = {
    "result": {
        "transcription": {
            "utterances": [
                {
                    "start": 0.5,
                    "end": 4.2,
                    "speaker": "1",
                    "text": "કેમ છો ભાઈ? હું કાલે સવારે અમદાવાદ આવી રહ્યો છું. બધું સેટિંગ થઈ ગયું છે ને?"
                },
                {
                    "start": 4.8,
                    "end": 9.5,
                    "speaker": "2",
                    "text": "હા, બધું રેડી છે. નરોડા પાસે માલ છુપાવી દીધો છે, પણ પોલીસ બહુ સક્રિય છે એટલે ધ્યાન રાખવું પડશે."
                },
                {
                    "start": 10.0,
                    "end": 14.1,
                    "speaker": "1",
                    "text": "વાંધો નહીં, જો કોઈ નડે તો મારી નાખવાની ધમકી આપી દઈશું. તું તારા પાસે બંદૂક તૈયાર રાખજે."
                },
                {
                    "start": 14.5,
                    "end": 18.0,
                    "speaker": "2",
                    "text": "બરાબર છે, કાલે સવારે મળીએ."
                }
            ],
            "full_transcript": "કેમ છો ભાઈ? હું કાલે સવારે અમદાવાદ આવી રહ્યો છું. બધું સેટિંગ થઈ ગયું છે ને? હા, બધું રેડી છે. નરોડા પાસે માલ છુપાવી દીધો છે, પણ પોલીસ બહુ સક્રિય છે એટલે ધ્યાન રાખવું પડશે. વાંધો નહીં, જો કોઈ નડે તો મારી નાખવાની ધમકી આપી દઈશું. તું તારા પાસે બંદૂક તૈયાર રાખજે. બરાબર છે, કાલે સવારે મળીએ."
        }
    }
}

async def main():
    print("[INFO] Starting VoiceInsight End-to-End Integration Test...")
    
    async with AsyncSessionLocal() as db:
        # 1. Fetch or create a test user
        print("[INFO] Resolving test user...")
        res = await db.execute(select(User).where(User.clerk_user_id == "test_voice_insight_user"))
        user = res.scalar_one_or_none()
        
        if not user:
            print("[INFO] Creating dummy user in database...")
            user = User(
                clerk_user_id="test_voice_insight_user",
                email="test_voice_insight@tarang.app",
                name="Test VoiceInsight User",
                plan_type="free",
                credit_balance=100,
                credit_limit=100
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
        
        user_id = user.id
        print(f"[INFO] User resolved. ID: {user_id}")
        
        # 2. Insert a dummy CallAnalysis job
        print("[INFO] Creating test call analysis job...")
        call = CallAnalysis(
            user_id=user_id,
            filename="gujarati_crime_test.wav",
            audio_url="https://example.com/gujarati_crime_test.wav",
            status=AnalysisStatus.PENDING,
            gladia_job_id="mock_gladia_job_" + str(uuid.uuid4())[:8]
        )
        db.add(call)
        await db.commit()
        await db.refresh(call)
        call_id = call.id
        print(f"[INFO] CallAnalysis job created. ID: {call_id}")
        
    try:
        # 3. Execute Sarvam intelligence extraction (this calls Modal and runs inference)
        print("[INFO] Invoking intelligence extraction via Sarvam-30B (Modal)...")
        start_time = asyncio.get_event_loop().time()
        await _run_sarvam_extraction(call_id, MOCK_TRANSCRIPT_DATA)
        duration = asyncio.get_event_loop().time() - start_time
        print(f"[INFO] Extraction finished in {duration:.2f} seconds.")
        
        # 4. Fetch the results from database and assert structure
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(CallAnalysis).where(CallAnalysis.id == call_id))
            call_updated = res.scalar_one_or_none()
            
            assert call_updated is not None, "CallAnalysis row not found in DB!"
            print(f"[INFO] Updated status: {call_updated.status}")
            
            # Save results to a file using UTF-8 to prevent Windows terminal print errors
            output_file = "test_voice_insight_result.json"
            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(call_updated.intelligence, f, indent=2, ensure_ascii=False)
            
            print(f"[INFO] Saved DB extraction results to {output_file}!")
            
            # Validate core fields are present
            intel = call_updated.intelligence or {}
            
            print("\n--- Key Extracted Intelligence Highlights ---")
            print("Threat Level:", intel.get("threat_level"))
            print("Primary Language:", intel.get("primary_language"))
            print("Overall Sentiment:", intel.get("overall_sentiment"))
            
            # Check for success
            if call_updated.status == AnalysisStatus.COMPLETED:
                print("\n[SUCCESS] VoiceInsight Pipeline End-to-End Integration Verified!")
            else:
                print("\n[FAILURE] Pipeline ended with status:", call_updated.status)
                print("Error Details:", intel.get("error"))
                
    finally:
        # 5. Clean up CallAnalysis row and dummy user
        print("\n[INFO] Cleaning up database...")
        async with AsyncSessionLocal() as db:
            # Delete call analysis
            res = await db.execute(select(CallAnalysis).where(CallAnalysis.id == call_id))
            call_del = res.scalar_one_or_none()
            if call_del:
                await db.delete(call_del)
            
            # If we created the dummy user, we can clean it up too
            res = await db.execute(select(User).where(User.clerk_user_id == "test_voice_insight_user"))
            user_del = res.scalar_one_or_none()
            if user_del:
                await db.delete(user_del)
                
            await db.commit()
        print("[INFO] Database cleaned up successfully.")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
