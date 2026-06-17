import uuid
from types import SimpleNamespace

import pytest

from app.models.clone_job import CloneJobStatus
from app.models.history import History
from app.services import clone_service


class FakeDb:
    def __init__(self):
        self.added = []
        self.commits = 0

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.commits += 1


@pytest.mark.asyncio
async def test_fail_clone_refunds_precharged_credits(monkeypatch):
    refund_calls = []

    async def fake_refund(db, user_id, amount, description="", clone_job_id=None):
        refund_calls.append((user_id, amount, description, clone_job_id))
        return 100

    monkeypatch.setattr(clone_service, "refund_credits", fake_refund)

    job = SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        status=None,
        clone_stage=None,
        error_message=None,
        credits_deducted=True,
        credit_cost=42,
    )
    db = FakeDb()

    await clone_service._fail_clone(db, job, "Clone failed", "raw provider error")

    assert job.status == CloneJobStatus.failed
    assert job.clone_stage == "failed"
    assert job.error_message == "Clone failed"
    assert job.credits_deducted is False
    assert refund_calls == [
        (job.user_id, 42, "clone_failed_refund", job.id)
    ]
    assert any(isinstance(item, History) for item in db.added)
    assert db.commits == 1
