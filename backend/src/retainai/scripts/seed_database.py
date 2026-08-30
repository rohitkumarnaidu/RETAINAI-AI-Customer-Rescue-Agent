"""Database Seeding Script for RETAINAI Dataset (101 Customers)."""

import asyncio
import json
import logging
from pathlib import Path
from datetime import datetime, date, timedelta, timezone
from retainai.db.session import engine, Base, AsyncSessionLocal
from retainai.db.models import (
    Customer,
    RiskLevel,
    UsageEvent,
    SupportTicket,
    CustomerFeedback,
    ExperienceMemory,
    ValidationStatus,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("retainai.seed")


def get_dataset_path() -> Path:
    candidates = [
        Path("data/seed/retainai_dataset_v2.json"),
        Path("../data/seed/retainai_dataset_v2.json"),
        Path("../../data/seed/retainai_dataset_v2.json"),
        Path(__file__).resolve().parents[4] / "data" / "seed" / "retainai_dataset_v2.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    raise FileNotFoundError("Could not find data/seed/retainai_dataset_v2.json")


def parse_dt(val: str | None) -> datetime | None:
    if not val:
        return None
    try:
        return datetime.fromisoformat(val)
    except Exception:
        return None


def parse_date(val: str | None, default: date | None = None) -> date:
    if not val:
        return default or date.today()
    try:
        return datetime.fromisoformat(val).date()
    except Exception:
        return default or date.today()


ARCHETYPE_RISK_MAP = {
    "ACME_HERO": RiskLevel.HEALTHY,
    "HEALTHY": RiskLevel.HEALTHY,
    "RECOVERING": RiskLevel.STABLE,
    "EARLY_WARNING": RiskLevel.WATCH,
    "AT_RISK": RiskLevel.AT_RISK,
    "CRITICAL": RiskLevel.CRITICAL,
}

ARCHETYPE_HEALTH_MAP = {
    "ACME_HERO": 88.0,
    "HEALTHY": 92.5,
    "RECOVERING": 78.0,
    "EARLY_WARNING": 68.0,
    "AT_RISK": 42.0,
    "CRITICAL": 18.0,
}


async def seed_demo_data():
    logger.info("Initializing database schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    dataset_path = get_dataset_path()
    logger.info(f"Loading dataset from {dataset_path}...")
    with open(dataset_path, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    async with AsyncSessionLocal() as db:
        customers_data = dataset.get("customers", [])
        logger.info(f"Seeding {len(customers_data)} customer records...")

        for c in customers_data:
            arch = c.get("archetype", "HEALTHY")
            risk_lvl = ARCHETYPE_RISK_MAP.get(arch, RiskLevel.HEALTHY)
            health_val = float(c.get("health_score") or ARCHETYPE_HEALTH_MAP.get(arch, 85.0))
            created_dt = parse_dt(c.get("created_at")) or datetime.now(timezone.utc)

            cust = Customer(
                id=c["id"],
                external_id=c.get("external_id") or f"ext-{c['id'][:8]}",
                name=c["name"],
                domain=c.get("domain") or c.get("website") or f"{c['name'].lower().replace(' ', '')}.com",
                segment=c.get("segment") or c.get("tier") or "Enterprise",
                industry=c.get("industry") or "Software",
                plan=c.get("plan") or f"{c.get('tier', 'Enterprise')} Tier",
                mrr=float(c.get("mrr", 0.0)),
                arr=float(c.get("arr") or (c.get("mrr", 0.0) * 12.0)),
                csm_name=c.get("csm_name") or "Auto CSM",
                csm_email=c.get("csm_email") or f"{c.get('csm_name', 'Auto CSM').lower().replace(' ', '.')}@retainai.io",
                start_date=created_dt.date() if isinstance(created_dt, datetime) else date.today(),
                renewal_date=parse_date(c.get("renewal_date"), date.today() + timedelta(days=365)),
                status=c.get("status", "ACTIVE"),
                health_score=health_val,
                risk_level=risk_lvl,
                is_false_positive_candidate=c.get("archetype") == "FALSE_POSITIVE" or bool(c.get("is_false_positive_candidate", False)),
                created_at=created_dt,
            )
            db.add(cust)

        usage_data = dataset.get("usage_events", [])
        logger.info(f"Seeding {len(usage_data)} usage event records...")
        for u in usage_data:
            ts = parse_dt(u.get("timestamp")) or datetime.now(timezone.utc)
            dau_val = int(u.get("dau") or u.get("daily_active_users") or 0)
            clicks = int(u.get("core_feature_clicks") or u.get("feature_clicks") or 0)
            exports = int(u.get("export_events") or 0)
            admin_logins = int(u.get("admin_logins") or 0)

            usage_evt = UsageEvent(
                id=u["id"],
                customer_id=u["customer_id"],
                timestamp=ts,
                daily_active_users=dau_val,
                active_users=dau_val,
                wau=u.get("wau") or (dau_val * 5),
                mau=u.get("mau") or (dau_val * 20),
                total_sessions=clicks + exports,
                license_utilization=float(u.get("license_utilization_pct") or u.get("license_utilization") or 0.0),
                job_completion_rate=float(u.get("job_completion_rate", 1.0)),
                feature_clicks=clicks,
                sessions=u.get("sessions") or (admin_logins + exports),
                usage_minutes=float(u.get("usage_minutes") or (dau_val * 15.0)),
                feature_adoption_rates=u.get("feature_adoption_rates") or {},
                event_type=u.get("event_type", "DAILY_SUMMARY"),
                metadata_json=u.get("metadata"),
            )
            db.add(usage_evt)

        ticket_data = dataset.get("support_tickets", [])
        logger.info(f"Seeding {len(ticket_data)} support ticket records...")
        for t in ticket_data:
            created_dt = parse_dt(t.get("created_at")) or datetime.now(timezone.utc)
            resolved_dt = parse_dt(t.get("resolved_at"))

            ticket = SupportTicket(
                id=t["id"],
                customer_id=t["customer_id"],
                external_ticket_id=t.get("external_ticket_id") or f"ext-{t['id'][:8]}",
                created_at=created_dt,
                resolved_at=resolved_dt,
                severity=t.get("severity", "MEDIUM"),
                category=t.get("category", "BUG"),
                status=t.get("status", "OPEN"),
                csat=t.get("csat"),
                subject=t.get("subject", "Support Issue"),
                description=t.get("description") or t.get("subject", "Support Issue"),
            )
            db.add(ticket)

        feedback_data = dataset.get("customer_feedbacks", [])
        logger.info(f"Seeding {len(feedback_data)} customer feedback records...")
        for f in feedback_data:
            created_dt = parse_dt(f.get("timestamp") or f.get("created_at")) or datetime.now(timezone.utc)
            s_val = f.get("sentiment", "NEUTRAL")
            sent_score = f.get("sentiment_score")
            if sent_score is None:
                sent_score = 1.0 if s_val == "POSITIVE" else (-1.0 if s_val == "NEGATIVE" else 0.0)

            txt = f.get("feedback_text") or f.get("text", "")

            fb = CustomerFeedback(
                id=f["id"],
                customer_id=f["customer_id"],
                created_at=created_dt,
                source=f.get("channel") or f.get("source", "CSAT_SURVEY"),
                score=f.get("score"),
                sentiment=s_val,
                sentiment_score=float(sent_score),
                text=txt,
                comment=txt,
                category=f.get("category", "GENERAL"),
            )
            db.add(fb)

        # Seed initial Experience Memory Bank
        mem1 = ExperienceMemory(
            id="mem-001",
            context_pattern="Enterprise Account CSV Export Friction & Usage Drop",
            customer_segment="Enterprise",
            risk_pattern="HIGH_RISK_SUPPORT_BUG_FRICTION",
            signals=["UNRESOLVED_CRITICAL_TICKET", "USAGE_DECLINE", "NEGATIVE_FEEDBACK"],
            recommended_strategy="ENGINEERING_ESCALATION_AND_EXECUTIVE_CHECKIN",
            actual_action="Escalate fix to Sprint Priority 1; 1-on-1 Product Head checkin",
            observed_outcome="Customer usage recovered +44 points within 14 days of patch deployment.",
            confidence=0.92,
            validation_status=ValidationStatus.VALIDATED,
            success_count=4,
            failure_count=0,
            evidence_ids=["TICK-101", "FEED-201"],
        )
        db.add(mem1)

        await db.commit()
        logger.info(
            f"Database seeding completed successfully: {len(customers_data)} customers, "
            f"{len(usage_data)} usage events, {len(ticket_data)} tickets, {len(feedback_data)} feedbacks."
        )


async def seed_data():
    await seed_demo_data()


if __name__ == "__main__":
    asyncio.run(seed_demo_data())

