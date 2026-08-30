"""Telemetry Repository for Usage Events, Support Tickets, Customer Feedback, and Account Events."""

from typing import List
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import (
    UsageEvent,
    SupportTicket,
    CustomerFeedback,
    AccountEvent,
)


class TelemetryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # Usage Events
    async def add_usage_event(self, event: UsageEvent) -> UsageEvent:
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def get_usage_events(self, customer_id: str, days: int = 30) -> List[UsageEvent]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        res = await self.db.execute(
            select(UsageEvent)
            .where(UsageEvent.customer_id == customer_id, UsageEvent.timestamp >= cutoff)
            .order_by(UsageEvent.timestamp.asc())
        )
        return list(res.scalars().all())

    # Support Tickets
    async def add_support_ticket(self, ticket: SupportTicket) -> SupportTicket:
        self.db.add(ticket)
        await self.db.commit()
        await self.db.refresh(ticket)
        return ticket

    async def get_support_tickets(self, customer_id: str, days: int = 30) -> List[SupportTicket]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        res = await self.db.execute(
            select(SupportTicket)
            .where(SupportTicket.customer_id == customer_id, SupportTicket.created_at >= cutoff)
            .order_by(SupportTicket.created_at.desc())
        )
        return list(res.scalars().all())

    # Customer Feedback
    async def add_feedback(self, feedback: CustomerFeedback) -> CustomerFeedback:
        self.db.add(feedback)
        await self.db.commit()
        await self.db.refresh(feedback)
        return feedback

    async def get_feedback_entries(self, customer_id: str, days: int = 30) -> List[CustomerFeedback]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        res = await self.db.execute(
            select(CustomerFeedback)
            .where(CustomerFeedback.customer_id == customer_id, CustomerFeedback.created_at >= cutoff)
            .order_by(CustomerFeedback.created_at.desc())
        )
        return list(res.scalars().all())

    # Account Events
    async def add_account_event(self, event: AccountEvent) -> AccountEvent:
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def get_account_events(self, customer_id: str, days: int = 30) -> List[AccountEvent]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        res = await self.db.execute(
            select(AccountEvent)
            .where(AccountEvent.customer_id == customer_id, AccountEvent.timestamp >= cutoff)
            .order_by(AccountEvent.timestamp.desc())
        )
        return list(res.scalars().all())
