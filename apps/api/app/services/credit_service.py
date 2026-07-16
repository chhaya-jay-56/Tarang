# ─────────────────────────────────────────────────────────────────────────────
# WHY THIS FILE EXISTS:
# Shared credit deduction logic used by all service endpoints (TTS, clone,
# separation). Handles the atomic balance check → deduct → log transaction
# flow. Keeps credit logic DRY across services.
#
# CREDIT RATES:
#   TTS/Clone: ~3 credits/sec of output → ~200 credits/min
#   Separation (Demucs): ~10 credits/min of input audio
#   Voice Library: Free
#
# DEDUCTION MODES:
#   1. Pre-deduction by character count (TTS) — estimate before processing
#   2. Post-deduction by duration (separation) — deduct after processing
#
# FLOW: service calls estimate_credits() → check_and_deduct() → INSERT
#       credit_transaction → UPDATE user.credit_balance
# ─────────────────────────────────────────────────────────────────────────────

import logging
import math
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.credit_transaction import CreditTransaction, TxnType

logger = logging.getLogger("tarang.credits")

# ── Rate constants ──

# TTS: 500 credits / min. ~800 chars = 500cr -> 0.625 credits/char
CREDITS_PER_CHAR_TTS = 0.625

# Voice Creation (IVC Enrollment): 250 credits flat
CREDITS_VOICE_CREATION = 250

# IVC Generation Tax: 190 credits per request
CREDITS_CLONE_TAX = 190

# Separation (Demucs): 100 credits per 3 minutes of input audio
CREDITS_SEPARATION_PER_3_MIN = 100

async def check_credit_sufficient(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
) -> None:
    """Read-only credit balance check — raises ValueError if insufficient.

    WHY: Called at the TOP of credit-consuming endpoints to give instant
    "insufficient credits" feedback BEFORE any heavy processing (DB lookups,
    R2 downloads, Modal calls). The actual atomic check_and_deduct() still
    runs later for safe deduction.

    Does NOT deduct. Does NOT log a transaction.
    """
    if amount <= 0:
        return

    result = await db.execute(
        select(User.credit_balance).where(User.id == user_id)
    )
    balance = result.scalar_one_or_none()

    if balance is None:
        raise ValueError("User not found")
    if balance < amount:
        raise ValueError(
            f"Insufficient credits: need {amount}, have {balance}"
        )


def estimate_tts_credits(text: str) -> int:
    """Estimate credits needed for TTS based on character count.

    Formula: ceil(char_count * CREDITS_PER_CHAR_TTS)
    Minimum 1 credit for any non-empty text.
    """
    char_count = len(text.strip())
    if char_count == 0:
        return 0
    return max(1, math.ceil(char_count * CREDITS_PER_CHAR_TTS))


def estimate_clone_credits(text: str, is_custom: bool) -> int:
    """Estimate credits for OmniVoice cloning generation.
    TTS base cost + 190cr tax if using a custom voice.
    """
    base = estimate_tts_credits(text)
    if is_custom:
        return base + CREDITS_CLONE_TAX
    return base


def estimate_separation_credits(duration_seconds: float) -> int:
    """Estimate credits for audio separation based on duration.

    Formula: ceil((duration_seconds / 180) * 100)
    Minimum 1 credit.
    """
    if duration_seconds <= 0:
        return 0
    return max(1, math.ceil((duration_seconds / 180.0) * CREDITS_SEPARATION_PER_3_MIN))


async def check_and_deduct(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    description: str = "",
    clone_job_id: uuid.UUID | None = None,
    service_type: str | None = None,
) -> int:
    """Atomically check balance and deduct credits.

    Returns the new balance after deduction.
    Raises ValueError if insufficient credits.
    """
    if amount <= 0:
        raise ValueError("Deduction amount must be positive")

    result = await db.execute(
        update(User)
        .where(User.id == user_id, User.credit_balance >= amount)
        .values(credit_balance=User.credit_balance - amount)
        .returning(User.credit_balance)
    )
    new_balance = result.scalar_one_or_none()

    if new_balance is None:
        balance_result = await db.execute(
            select(User.credit_balance).where(User.id == user_id)
        )
        current_balance = balance_result.scalar_one_or_none()
        if current_balance is None:
            raise ValueError("User not found")
        raise ValueError(
            f"Insufficient credits: need {amount}, have {current_balance}"
        )

    # Log transaction
    txn = CreditTransaction(
        user_id=user_id,
        clone_job_id=clone_job_id,
        txn_type=TxnType.deduction,
        amount=amount,
        balance_after=new_balance,
        service_type=service_type,
    )
    db.add(txn)

    logger.info(
        "💳 Credit deduction: user=%s, amount=%s, new_balance=%s, desc=%s",
        user_id, amount, new_balance, description,
    )

    # Don't commit here — let the caller commit with the rest of their
    # transaction (e.g., history entry, job update).
    return new_balance


async def refund_credits(
    db: AsyncSession,
    user_id: uuid.UUID,
    amount: int,
    description: str = "",
    clone_job_id: uuid.UUID | None = None,
    service_type: str | None = None,
) -> int:
    """Refund credits back to user (e.g., on processing failure).

    Returns the new balance after refund.
    """
    if amount <= 0:
        raise ValueError("Refund amount must be positive")

    result = await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(credit_balance=User.credit_balance + amount)
        .returning(User.credit_balance)
    )
    new_balance = result.scalar_one_or_none()

    if new_balance is None:
        raise ValueError("User not found")

    txn = CreditTransaction(
        user_id=user_id,
        clone_job_id=clone_job_id,
        txn_type=TxnType.refund,
        amount=amount,
        balance_after=new_balance,
        service_type=service_type,
    )
    db.add(txn)

    logger.info(
        "💳 Credit refund: user=%s, amount=%s, new_balance=%s, desc=%s",
        user_id, amount, new_balance, description,
    )

    return new_balance
