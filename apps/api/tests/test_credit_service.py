import uuid

import pytest

from app.models.credit_transaction import CreditTransaction, TxnType
from app.services.credit_service import check_and_deduct, refund_credits


class FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDb:
    def __init__(self, *results):
        self.results = list(results)
        self.added = []

    async def execute(self, _statement):
        return self.results.pop(0)

    def add(self, obj):
        self.added.append(obj)


@pytest.mark.asyncio
async def test_check_and_deduct_writes_deduction_transaction():
    user_id = uuid.uuid4()
    clone_job_id = uuid.uuid4()
    db = FakeDb(FakeResult(75))

    balance = await check_and_deduct(
        db,
        user_id,
        25,
        "test",
        clone_job_id=clone_job_id,
    )

    assert balance == 75
    txn = db.added[0]
    assert isinstance(txn, CreditTransaction)
    assert txn.user_id == user_id
    assert txn.clone_job_id == clone_job_id
    assert txn.txn_type == TxnType.deduction
    assert txn.amount == 25
    assert txn.balance_after == 75


@pytest.mark.asyncio
async def test_check_and_deduct_rejects_insufficient_balance():
    db = FakeDb(FakeResult(None), FakeResult(7))

    with pytest.raises(ValueError, match="Insufficient credits"):
        await check_and_deduct(db, uuid.uuid4(), 25, "test")


@pytest.mark.asyncio
async def test_refund_credits_writes_refund_transaction():
    user_id = uuid.uuid4()
    clone_job_id = uuid.uuid4()
    db = FakeDb(FakeResult(125))

    balance = await refund_credits(
        db,
        user_id,
        25,
        "test refund",
        clone_job_id=clone_job_id,
    )

    assert balance == 125
    txn = db.added[0]
    assert txn.txn_type == TxnType.refund
    assert txn.user_id == user_id
    assert txn.clone_job_id == clone_job_id
    assert txn.amount == 25
    assert txn.balance_after == 125
