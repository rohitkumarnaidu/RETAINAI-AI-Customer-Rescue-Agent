"""Telemetry Repository for Usage Events, Support Tickets, Customer Feedback, and Account Events — Tenant-Isolated."""

from typing import List, Optional
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
    def __init__(self, db: AsyncSession, tenant_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id

    # Usage Events
    async def add_usage_event(self, event: UsageEvent) -> UsageEvent:
        if not event.tenant_id and self.tenant_id:
            event.tenant_id = self.tenant_id
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def get_usage_events(self, customer_id: str, days: int = 30, tenant_id: Optional[str] = None) -> List[UsageEvent]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        tid = tenant_id or self.tenant_id
        q = select(UsageEvent).where(UsageEvent.customer_id == customer_id, UsageEvent.timestamp >= cutoff)
        if tid:
            q = q.where((UsageEvent.tenant_id == tid) | (UsageEvent.tenant_id.is_(None)))
        q = q.order_by(UsageEvent.timestamp.asc())
        res = await self.db.execute(q)
        return list(res.scalars().all())

    # Support Tickets
    async def add_support_ticket(self, ticket: SupportTicket) -> SupportTicket:
        if not ticket.tenant_id and self.tenant_id:
            ticket.tenant_id = self.tenant_id
        self.db.add(ticket)
        await self.db.commit()
        await self.db.refresh(ticket)
        return ticket

    async def get_support_tickets(self, customer_id: str, days: int = 30, tenant_id: Optional[str] = None) -> List[SupportTicket]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        tid = tenant_id or self.tenant_id
        q = select(SupportTicket).where(SupportTicket.customer_id == customer_id, SupportTicket.created_at >= cutoff)
        if tid:
            q = q.where((SupportTicket.tenant_id == tid) | (SupportTicket.tenant_id.is_(None)))
        q = q.order_by(SupportTicket.created_at.desc())
        res = await self.db.execute(q)
        return list(res.scalars().all())

    # Customer Feedback
    async def add_feedback(self, feedback: CustomerFeedback) -> CustomerFeedback:
        if not feedback.tenant_id and self.tenant_id:
            feedback.tenant_id = self.tenant_id
        self.db.add(feedback)
        await self.db.commit()
        await self.db.refresh(feedback)
        return feedback

    async def get_feedback_entries(self, customer_id: str, days: int = 30, tenant_id: Optional[str] = None) -> List[CustomerFeedback]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        tid = tenant_id or self.tenant_id
        q = select(CustomerFeedback).where(CustomerFeedback.customer_id == customer_id, CustomerFeedback.created_at >= cutoff)
        if tid:
            q = q.where((CustomerFeedback.tenant_id == tid) | (CustomerFeedback.tenant_id.is_(None)))
        q = q.order_by(CustomerFeedback.created_at.desc())
        res = await self.db.execute(q)
        return list(res.scalars().all())

    # Account Events
    async def add_account_event(self, event: AccountEvent) -> AccountEvent:
        if not event.tenant_id and self.tenant_id:
            event.tenant_id = self.tenant_id
        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def get_account_events(self, customer_id: str, days: int = 30, tenant_id: Optional[str] = None) -> List[AccountEvent]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        tid = tenant_id or self.tenant_id
        q = select(AccountEvent).where(AccountEvent.customer_id == customer_id, AccountEvent.timestamp >= cutoff)
        if tid:
            q = q.where((AccountEvent.tenant_id == tid) | (AccountEvent.tenant_id.is_(None)))
        q = q.order_by(AccountEvent.timestamp.desc())
        res = await self.db.execute(q)
        return list(res.scalars().all())
