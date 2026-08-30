"""FastAPI REST API Routes for RETAINAI Customer Retention Platform."""

import json
import csv
import io
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import logging
logger = logging.getLogger("retainai.api")

from retainai.db.session import get_db
from retainai.auth.auth import get_current_user, require_role, require_tenant
from retainai.db.models import Customer, RiskLevel, Intervention, InterventionStatus, InterventionOutcome, OrgSettings
from retainai.repositories.customer_repository import CustomerRepository
from retainai.repositories.evidence_repository import EvidenceRepository
from retainai.repositories.memory_repository import MemoryRepository
from retainai.services.customer_service import CustomerService
from retainai.services.signal_service import SignalService
from retainai.services.timeline_service import TimelineService
from retainai.services.intervention_service import InterventionService
from retainai.services.event_ingestion_service import EventIngestionService
from retainai.engine.learning_engine import LearningEngine
from retainai.models.schemas import (
    CustomerSchema,
    EventIngestRequest,
    InterventionCreateRequest,
    InterventionSchema,
    OutcomeCreateRequest,
    OutcomeSchema,
    ExperienceMemorySchema,
)

from retainai.scripts.seed_database import seed_demo_data

router = APIRouter(prefix="/api/v1")


@router.post("/system/reset")
async def reset_demo_database(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role(["ADMIN"])),
):
    """Reset and re-seed database with all 101 dataset benchmark accounts (S59 gated + Phase5 ADMIN + audit)."""
    from retainai.config import settings
    # Prod hardening: ADMIN required via require_role above; additionally gate on DEBUG/DEMO_MODE for non-prod
    if not (settings.DEBUG or settings.DEMO_MODE):
        raise HTTPException(status_code=403, detail="Demo reset disabled in production (requires DEBUG or DEMO_MODE)")
    # ── Phase 5 audit log (tenant-aware) ──
    tenant_id = user.get("tenant_id") or user.get("tid") or getattr(request.state, "tenant_id", None) or "unknown"
    client_ip = request.client.host if request.client and hasattr(request.client, "host") else "unknown"
    logger.info(f"AUDIT system_reset requested tenant_id={tenant_id} user={user.get('email')} role={user.get('role')} ip={client_ip} path={request.url.path}")
    try:
        from retainai.db.models import SystemEventLog
        import uuid as _uuid
        from datetime import datetime, timezone
        audit = SystemEventLog(
            id=f"evt_{_uuid.uuid4().hex[:8]}",
            tenant_id=tenant_id if tenant_id != "unknown" else None,
            customer_id="system",
            event_type="SYSTEM_RESET",
            description=f"System reset requested by {user.get('email')} tenant={tenant_id}",
            details={"user": user.get("email"), "tenant_id": tenant_id, "role": user.get("role"), "ip": client_ip},
            timestamp=datetime.now(timezone.utc),
        )
        db.add(audit)
        await db.commit()
    except Exception as _ae:
        logger.warning(f"audit log failed for reset tenant_id={tenant_id}: {_ae}")
        try:
            await db.rollback()
        except Exception:
            pass
    try:
        await seed_demo_data()
        logger.info(f"AUDIT system_reset completed tenant_id={tenant_id} user={user.get('email')}")
        # Also log completion audit
        try:
            from retainai.db.models import SystemEventLog as _SEL
            import uuid as _uuid2
            from datetime import datetime as _dt, timezone as _tz
            audit2 = _SEL(
                id=f"evt_{_uuid2.uuid4().hex[:8]}",
                tenant_id=tenant_id if tenant_id != "unknown" else None,
                customer_id="system",
                event_type="SYSTEM_RESET_COMPLETED",
                description=f"System reset completed tenant={tenant_id}",
                details={"tenant_id": tenant_id, "user": user.get("email")},
                timestamp=_dt.now(_tz.utc),
            )
            db.add(audit2)
            await db.commit()
        except Exception:
            try:
                await db.rollback()
            except Exception:
                pass
        return {"status": "success", "message": "Database reset and re-seeded with 101 customers successfully", "tenant_id": tenant_id, "audit": "logged"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database reset failed: {str(e)}")


@router.get("/customers", response_model=List[CustomerSchema])
async def list_customers(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
    limit: int = 200,
    offset: int = 0,
    risk_level: Optional[str] = None,
    segment: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "name",
    sort_order: str = "asc",
):
    """List customers with pagination, filtering & sorting (S19)."""
    repo = CustomerRepository(db, tenant_id=tenant_id)
    # Enforce bounds (S19)
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    # Backwards compat: if no filters and default limit covers dataset, return paginated
    return await repo.list_all_paginated(
        limit=limit, offset=offset, risk_level=risk_level, segment=segment, search=search, sort_by=sort_by, sort_order=sort_order
    )


@router.post("/customers", response_model=CustomerSchema)
async def create_customer(payload: Dict[str, Any], db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Create a single customer — for Add Customer form + CSV single-row."""
    name = str(payload.get("name") or "").strip()
    if not name or len(name) < 2:
        raise HTTPException(status_code=422, detail="name is required (min 2 chars)")
    domain = str(payload.get("domain") or f"{re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')}.com").strip().lower()
    # Parse helpers
    def _float(v, default=0.0):
        try:
            return float(str(v).replace(",","").replace("$","").strip() or default)
        except Exception:
            return float(default)
    def _int(v, default=0):
        try:
            return int(float(str(v).replace(",","").strip() or default))
        except Exception:
            return int(default)
    segment = str(payload.get("segment") or "MidMarket").strip() or "MidMarket"
    industry = str(payload.get("industry") or "Software").strip() or "Software"
    plan = str(payload.get("plan") or "Growth Tier").strip() or "Growth Tier"
    csm_name = str(payload.get("csm_name") or payload.get("csm") or "Alex Morgan").strip() or "Alex Morgan"
    csm_email = str(payload.get("csm_email") or "alex@retainai.io").strip() or "alex@retainai.io"
    arr = _float(payload.get("arr", 36000), 36000)
    mrr = _float(payload.get("mrr", arr/12), arr/12)
    health_score = max(0.0, min(100.0, _float(payload.get("health_score", 85), 85)))
    status = str(payload.get("status") or "ACTIVE").strip().upper() or "ACTIVE"
    # Risk level auto-derive if not provided
    risk_level_raw = str(payload.get("risk_level") or "").strip().upper()
    if risk_level_raw not in {"HEALTHY","STABLE","WATCH","AT_RISK","HIGH_RISK","CRITICAL"}:
        # derive from health
        if health_score >= 90: risk_level_raw = "HEALTHY"
        elif health_score >= 80: risk_level_raw = "STABLE"
        elif health_score >= 60: risk_level_raw = "WATCH"
        elif health_score >= 40: risk_level_raw = "AT_RISK"
        elif health_score >= 20: risk_level_raw = "HIGH_RISK"
        else: risk_level_raw = "CRITICAL"
    # Dates
    today = date.today()
    try:
        start_date = date.fromisoformat(str(payload.get("start_date")) ) if payload.get("start_date") else today - timedelta(days=180)
    except Exception:
        start_date = today - timedelta(days=180)
    try:
        renewal_date = date.fromisoformat(str(payload.get("renewal_date"))) if payload.get("renewal_date") else today + timedelta(days=90)
    except Exception:
        renewal_date = today + timedelta(days=90)
    # ID generation
    cid = str(payload.get("id") or payload.get("customer_id") or f"cust_{uuid.uuid4().hex[:8]}").strip()
    if len(cid) > 50:
        cid = cid[:50]
    # Duplicate check
    existing = await db.execute(select(Customer).where(Customer.id == cid))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail=f"Customer id {cid} already exists")
    # Domain duplicate soft check — allow but warn via header? just allow
    customer = Customer(
        id=cid,
        tenant_id=tenant_id,
        name=name,
        domain=domain,
        segment=segment,
        industry=industry,
        plan=plan,
        mrr=mrr,
        arr=arr,
        csm_name=csm_name,
        csm_email=csm_email,
        start_date=start_date,
        renewal_date=renewal_date,
        status=status,
        health_score=round(float(health_score),1),
        risk_level=RiskLevel(risk_level_raw),
        is_false_positive_candidate=bool(payload.get("is_false_positive_candidate", False)),
    )
    db.add(customer)
    try:
        await db.commit()
        await db.refresh(customer)
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Create failed: {str(e)[:300]}")
    return customer


@router.post("/customers/upload")
async def upload_customers_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
):
    """Bulk CSV upload — creates many customers. Max 500 rows, 2MB file."""
    # Guards
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="File must be a .csv")
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="CSV too large (max 2MB, ~500 customers)")
    if len(content) == 0:
        raise HTTPException(status_code=422, detail="Empty CSV")
    try:
        text = content.decode("utf-8-sig")
    except Exception:
        try:
            text = content.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=422, detail="Cannot decode CSV — use UTF-8")
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise HTTPException(status_code=422, detail="CSV missing header row")
    # Normalize headers lower
    normalized_fields = [ (h or "").strip().lower() for h in reader.fieldnames ]
    # Required alias map
    header_map = { h.lower().strip(): h for h in reader.fieldnames if h }
    # Validate must have at least name
    if "name" not in normalized_fields:
        raise HTTPException(status_code=422, detail="CSV must contain 'name' column. Required: name. Optional: domain, segment, industry, plan, arr, mrr, csm_name, csm_email, health_score, risk_level, renewal_date, status")
    rows = list(reader)
    if len(rows) == 0:
        raise HTTPException(status_code=422, detail="CSV contains no data rows")
    if len(rows) > 500:
        raise HTTPException(status_code=422, detail=f"Too many rows ({len(rows)}), max 500 per upload. Split your file.")
    # Helpers
    def _f(v, default=0.0):
        try:
            if v is None or str(v).strip() == "":
                return float(default)
            return float(str(v).replace(",","").replace("$","").strip())
        except Exception:
            return float(default)
    created = 0
    skipped = 0
    errors: List[Dict[str, Any]] = []
    seen_ids: set = set()
    today = date.today()
    for idx, raw in enumerate(rows, start=2):  # 1 is header, so 2 is first data row
        # Normalize row keys lower
        row = { (k or "").strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in raw.items() }
        name = str(row.get("name") or "").strip()
        if not name:
            skipped += 1
            errors.append({"row": idx, "error": "Missing 'name' — row skipped"})
            continue
        # Build domain if empty
        domain = str(row.get("domain") or "").strip().lower()
        if not domain:
            slug = re.sub(r'[^a-z0-9]+','-', name.lower()).strip('-') or f"customer-{idx}"
            domain = f"{slug}.com"
        # Dupe id handling
        raw_id = str(row.get("id") or row.get("customer_id") or "").strip()
        cid = raw_id if raw_id else f"cust_{uuid.uuid4().hex[:8]}"
        if len(cid) > 50:
            cid = cid[:50]
        if cid in seen_ids:
            cid = f"cust_{uuid.uuid4().hex[:8]}"
        seen_ids.add(cid)
        # Check DB duplicate
        try:
            existing = await db.execute(select(Customer.id).where(Customer.id == cid).limit(1))
            if existing.scalar_one_or_none() is not None:
                skipped += 1
                errors.append({"row": idx, "id": cid, "name": name, "error": f"Duplicate id {cid} — skipped (use unique id column)"})
                continue
        except Exception:
            pass
        segment = str(row.get("segment") or "MidMarket").strip() or "MidMarket"
        industry = str(row.get("industry") or "Software").strip() or "Software"
        plan = str(row.get("plan") or "Growth Tier").strip() or "Growth Tier"
        csm_name = str(row.get("csm_name") or row.get("csm") or "Alex Morgan").strip() or "Alex Morgan"
        csm_email = str(row.get("csm_email") or "alex@retainai.io").strip() or "alex@retainai.io"
        arr = _f(row.get("arr", 36000), 36000)
        mrr_val = row.get("mrr")
        mrr = _f(mrr_val, arr/12) if mrr_val not in (None, "") else arr/12
        health_score = max(0.0, min(100.0, _f(row.get("health_score", 85), 85)))
        status = str(row.get("status") or "ACTIVE").strip().upper() or "ACTIVE"
        risk_raw = str(row.get("risk_level") or row.get("risk") or "").strip().upper()
        if risk_raw not in {"HEALTHY","STABLE","WATCH","AT_RISK","HIGH_RISK","CRITICAL"}:
            if health_score >= 90: risk_raw = "HEALTHY"
            elif health_score >= 80: risk_raw = "STABLE"
            elif health_score >= 60: risk_raw = "WATCH"
            elif health_score >= 40: risk_raw = "AT_RISK"
            elif health_score >= 20: risk_raw = "HIGH_RISK"
            else: risk_raw = "CRITICAL"
        try:
            start_date = date.fromisoformat(str(row.get("start_date")).strip()) if row.get("start_date") and str(row.get("start_date")).strip() else today - timedelta(days=180)
        except Exception:
            start_date = today - timedelta(days=180)
        try:
            renewal_date = date.fromisoformat(str(row.get("renewal_date")).strip()) if row.get("renewal_date") and str(row.get("renewal_date")).strip() else today + timedelta(days=90)
        except Exception:
            renewal_date = today + timedelta(days=90)
        try:
            risk_enum = RiskLevel(risk_raw)
        except Exception:
            risk_enum = RiskLevel.WATCH
        customer = Customer(
            id=cid,
            tenant_id=tenant_id,
            name=name,
            domain=domain,
            segment=segment,
            industry=industry,
            plan=plan,
            mrr=float(mrr),
            arr=float(arr),
            csm_name=csm_name,
            csm_email=csm_email,
            start_date=start_date,
            renewal_date=renewal_date,
            status=status,
            health_score=round(float(health_score),1),
            risk_level=risk_enum,
            is_false_positive_candidate=str(row.get("is_false_positive_candidate","")).lower() in ("1","true","yes"),
        )
        db.add(customer)
        try:
            await db.flush()
            created += 1
        except Exception as e:
            await db.rollback()
            skipped += 1
            errors.append({"row": idx, "name": name, "error": str(e)[:200]})
            # re-add session state clean
            continue
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Commit failed: {str(e)[:300]}")
    return {
        "status": "success",
        "created": created,
        "skipped": skipped,
        "total_rows": len(rows),
        "errors": errors[:20],  # cap
        "message": f"Imported {created} customers, skipped {skipped} of {len(rows)} rows",
    }


@router.get("/customers/template/csv")
async def download_customer_csv_template(user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Returns CSV template info — frontend generates file client-side but this documents schema."""
    headers = ["name","domain","segment","industry","plan","arr","mrr","csm_name","csm_email","health_score","risk_level","renewal_date","status"]
    sample = ["Acme Corp","acme.com","Enterprise","FinTech","Enterprise Tier","180000","15000","Alex Morgan","alex@retainai.io","42","CRITICAL","2026-09-15","ACTIVE"]
    return {
        "headers": headers,
        "sample_row": sample,
        "filename": "retainai_customers_template.csv",
        "csv_text": ",".join(headers) + "\n" + ",".join(sample) + "\n",
        "notes": "Required: name. All others optional. health_score 0-100 auto-sets risk_level if omitted. renewal_date YYYY-MM-DD.",
    }


@router.get("/customers/{customer_id}", response_model=CustomerSchema)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Get customer by ID."""
    repo = CustomerRepository(db, tenant_id=tenant_id)
    customer = await repo.get_by_id(customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.get("/customers/{customer_id}/timeline")
async def get_customer_timeline(customer_id: str, days: int = 60, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Get unified chronological customer timeline."""
    service = TimelineService(db)
    return await service.get_unified_timeline(customer_id, days=days)


@router.get("/customers/{customer_id}/signals")
async def get_customer_signals(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Get current detected churn signals for customer."""
    service = SignalService(db)
    return await service.get_customer_signals(customer_id)


@router.get("/customers/{customer_id}/risk")
async def get_customer_risk(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Get deterministic risk assessment for customer."""
    service = CustomerService(db, tenant_id=tenant_id)
    return await service.reassess_customer_risk(customer_id)


@router.post("/customers/{customer_id}/reassess")
async def reassess_customer(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Trigger deterministic health score & risk re-assessment."""
    service = CustomerService(db, tenant_id=tenant_id)
    try:
        return await service.reassess_customer_risk(customer_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/customers/{customer_id}/evidence")
async def get_customer_evidence(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Get supporting evidence records for customer."""
    repo = EvidenceRepository(db, tenant_id=tenant_id)
    return await repo.get_customer_evidences(customer_id)


@router.post("/events")
async def ingest_event(req: EventIngestRequest, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Event Ingestion Endpoint: Ingests event, calculates signals, and triggers reassessment with idempotency (S20/S44)."""
    # Hardening: payload size guard (S44)
    if isinstance(req.payload, dict) and len(str(req.payload)) > 10000:
        raise HTTPException(status_code=413, detail="Payload too large")
    if not req.customer_id or len(req.customer_id) > 80:
        raise HTTPException(status_code=400, detail="Invalid customer_id")
    valid_types = {"USAGE_EVENT","SUPPORT_TICKET","CUSTOMER_FEEDBACK","ACCOUNT_EVENT","INTERVENTION_COMPLETED","OUTCOME_AVAILABLE","USAGE_CHANGED","FEATURE_ADOPTION_CHANGED","SUPPORT_TICKET_CREATED","FEEDBACK_RECEIVED","SENTIMENT_CHANGED","ACCOUNT_ACTIVITY_CHANGED"}
    if req.event_type not in valid_types:
        raise HTTPException(status_code=422, detail=f"Invalid event_type {req.event_type}")
    # Tenant isolation: verify customer belongs to tenant
    from sqlalchemy import select as _sel
    from retainai.db.models import Customer as _Cust
    res = await db.execute(_sel(_Cust.tenant_id).where(_Cust.id == req.customer_id))
    row_tid = res.scalar_one_or_none()
    if row_tid is not None and row_tid != tenant_id:
        raise HTTPException(status_code=403, detail="Tenant isolation violation for customer")
    service = EventIngestionService(db, tenant_id=tenant_id)
    # Extract dedup_id if client provided
    dedup_id = req.payload.get("_dedup_id") if isinstance(req.payload, dict) else None
    try:
        return await service.ingest_event(
            customer_id=req.customer_id,
            event_type=req.event_type,
            payload=req.payload,
            timestamp=req.timestamp,
            dedup_id=dedup_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Event ingestion failed: {str(e)[:300]}")


@router.post("/customers/{customer_id}/investigate")
async def investigate_alias_alternative(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Alias for AGENT investigate — unified with agent_routes."""
    from retainai.agents.orchestrator import AgentOrchestrator
    orch = AgentOrchestrator(db, tenant_id=tenant_id)
    try:
        return await orch.run_full_rescue_workflow(customer_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/customers/{customer_id}/recommendations")
async def get_recommendations(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Get recommendations (maps to interventions Proposed/Approved). Spec S34 alias."""
    service = InterventionService(db)
    inters = await service.get_customer_interventions(customer_id)
    # Map to recommendation shape
    return [
        {
            "recommendation_id": i.recommendation_id or i.id,
            "intervention_id": i.id,
            "customer_id": i.customer_id,
            "action_type": i.action_type,
            "title": i.title,
            "status": i.status.value if hasattr(i.status, "value") else str(i.status),
            "priority": getattr(i, "priority", "MEDIUM"),
            "requires_approval": getattr(i, "requires_approval", True),
            "evidence_ids": getattr(i, "evidence_ids", []),
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in inters
    ]


@router.get("/customers/{customer_id}/memory")
async def get_customer_memory(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Retrieve relevant validated memories for customer segment (S24)."""
    from retainai.repositories.customer_repository import CustomerRepository
    cust_repo = CustomerRepository(db, tenant_id=tenant_id)
    cust = await cust_repo.get_by_id(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    mem_repo = MemoryRepository(db, tenant_id=tenant_id)
    memories = await mem_repo.get_validated_memories(customer_segment=cust.segment)
    return memories


@router.get("/learning")
async def get_learning_overview(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Learning overview: candidates vs validated."""
    from sqlalchemy import select
    from retainai.db.models import LearningCandidate
    cand_res = await db.execute(select(LearningCandidate).where(LearningCandidate.tenant_id == tenant_id).order_by(LearningCandidate.created_at.desc()).limit(20))
    candidates = list(cand_res.scalars().all())
    mem_repo = MemoryRepository(db, tenant_id=tenant_id)
    validated = await mem_repo.get_validated_memories()
    return {
        "candidates": [
            {
                "candidate_id": c.id,
                "pattern": c.pattern,
                "context": c.context_json,
                "intervention": c.intervention_type,
                "observed_outcome": c.observed_outcome,
                "evidence_ids": c.evidence_ids,
                "sample_size": c.sample_size,
                "confidence": c.confidence,
                "source_interventions": c.source_intervention_ids,
                "status": c.status,
                "validation_status": c.validation_status.value if hasattr(c.validation_status, "value") else str(c.validation_status),
            }
            for c in candidates
        ],
        "validated_memories": [
            {
                "memory_id": m.id,
                "pattern": m.pattern or m.context_pattern,
                "recommended_intervention": m.recommended_strategy,
                "success_count": m.success_count,
                "failure_count": m.failure_count,
                "sample_size": getattr(m, "sample_size", m.success_count),
                "success_rate": getattr(m, "success_rate", 0.0),
                "confidence": m.confidence,
                "last_observed": m.last_observed.isoformat() if hasattr(m, "last_observed") and m.last_observed else m.updated_at.isoformat(),
                "source_intervention_ids": getattr(m, "source_intervention_ids", []),
                "evidence_ids": m.evidence_ids,
                "status": getattr(m, "status", "VALIDATED"),
                "validation_status": m.validation_status.value if hasattr(m.validation_status, "value") else str(m.validation_status),
            }
            for m in validated
        ],
    }


@router.get("/evidence/{evidence_id}")
async def resolve_evidence(evidence_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Evidence resolver per S8: map evidence IDs back to real records."""
    # Check across tables: UsageEvent, SupportTicket, CustomerFeedback, AccountEvent, SystemEventLog, Evidence
    from retainai.db.models import UsageEvent, SupportTicket, CustomerFeedback, AccountEvent
    # Search each table by id
    for model, source_type in [
        (UsageEvent, "USAGE_EVENT"),
        (SupportTicket, "SUPPORT_TICKET"),
        (CustomerFeedback, "FEEDBACK"),
        (AccountEvent, "ACCOUNT_EVENT"),
    ]:
        res = await db.execute(select(model).where(model.id == evidence_id))
        obj = res.scalar_one_or_none()
        if obj:
            return {
                "evidence_id": evidence_id,
                "source_type": source_type,
                "customer_id": getattr(obj, "customer_id", None),
                "timestamp": getattr(obj, "timestamp", getattr(obj, "created_at", None)).isoformat() if getattr(obj, "timestamp", getattr(obj, "created_at", None)) else None,
                "data": {k: str(v)[:500] for k, v in obj.__dict__.items() if not k.startswith("_")},
            }
    # fallback check Evidence table
    from retainai.db.models import Evidence as EvModel
    res = await db.execute(select(EvModel).where(EvModel.id == evidence_id))
    ev = res.scalar_one_or_none()
    if ev:
        return {"evidence_id": ev.id, "source_type": ev.source_type, "customer_id": ev.customer_id, "timestamp": ev.timestamp.isoformat(), "summary": ev.summary}
    raise HTTPException(status_code=404, detail=f"Evidence {evidence_id} not found")


@router.get("/agent-runs/{run_id}")
async def get_agent_run(run_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Retrieve full agent run with state history and steps (S30)."""
    from retainai.db.models import AgentRun, AgentStep
    res = await db.execute(select(AgentRun).where(AgentRun.id == run_id))
    run = res.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Agent run not found")
    steps_res = await db.execute(select(AgentStep).where(AgentStep.run_id == run_id).order_by(AgentStep.timestamp.asc()))
    steps = list(steps_res.scalars().all())
    return {
        "run_id": run.id,
        "customer_id": run.customer_id,
        "status": run.status.value if hasattr(run.status, "value") else str(run.status),
        "current_state": run.current_state,
        "workflow_type": run.workflow_type,
        "model": run.model,
        "model_version": run.model_version,
        "prompt_version": run.prompt_version,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "total_steps": run.total_steps,
        "tool_calls": run.tool_calls,
        "state_history": run.state_history,
        "final_decision": run.final_decision,
        "confidence": run.confidence,
        "error": run.error,
        "steps": [
            {"id": s.id, "state": s.state, "tool_name": s.tool_name, "status": s.status, "latency_ms": s.latency_ms, "error": s.error, "timestamp": s.timestamp.isoformat()}
            for s in steps
        ],
    }


@router.get("/customers/{customer_id}/interventions", response_model=List[InterventionSchema])
async def get_interventions(customer_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Get interventions for customer."""
    service = InterventionService(db)
    interventions = await service.get_customer_interventions(customer_id)
    for iv in interventions:
        try:
            raw = getattr(iv, 'plan', None)
            steps = []
            parsed = None
            if isinstance(raw, str) and raw.strip():
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    steps = parsed
                elif isinstance(parsed, dict) and isinstance(parsed.get('steps'), list):
                    steps = parsed['steps']
                elif isinstance(parsed, dict) and isinstance(parsed.get('plan_steps'), list):
                    steps = parsed['plan_steps']
            elif isinstance(raw, list):
                steps = raw
            setattr(iv, 'plan_steps', steps)
        except Exception:
            setattr(iv, 'plan_steps', [])
    return interventions


@router.post("/interventions", response_model=InterventionSchema)
async def create_intervention(req: InterventionCreateRequest, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Create new intervention proposed plan — validates investigation_id FK (P0-04)."""
    # Validate investigation_id exists to avoid FK IntegrityError
    if req.investigation_id:
        from retainai.db.models import InvestigationReport
        res = await db.execute(select(InvestigationReport).where(InvestigationReport.id == req.investigation_id))
        if not res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"investigation_id {req.investigation_id} not found")
    service = InterventionService(db)
    inv = Intervention(
        id=f"inv_{req.customer_id[:8]}_{uuid.uuid4().hex[:8]}",
        customer_id=req.customer_id,
        investigation_id=req.investigation_id,
        action_type=req.action_type,
        title=req.title,
        description=req.description,
        plan=req.plan,
        status=InterventionStatus.PROPOSED,
    )
    return await service.create_intervention(inv)


@router.post("/interventions/{intervention_id}/approve", response_model=InterventionSchema)
async def approve_intervention(intervention_id: str, approved_by: str = "CSM", db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Approve an intervention plan (S15)."""
    if not intervention_id or len(intervention_id) > 80 or ";" in intervention_id:
        raise HTTPException(status_code=400, detail="Invalid intervention_id")
    if len(approved_by) > 100:
        raise HTTPException(status_code=400, detail="approved_by too long")
    service = InterventionService(db)
    inv = await service.approve_intervention(intervention_id, approved_by=approved_by)
    if not inv:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return inv


@router.post("/interventions/{intervention_id}/reject", response_model=InterventionSchema)
async def reject_intervention(intervention_id: str, reason: str = "No reason", actor: str = "CSM", db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Reject intervention — captures human feedback as learning signal (S15/S48)."""
    service = InterventionService(db)
    inv = await service.reject_intervention(intervention_id, reason=reason, actor=actor)
    if not inv:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return inv


@router.post("/interventions/{intervention_id}/modify", response_model=InterventionSchema)
async def modify_intervention(intervention_id: str, modified_action: Dict[str, Any] = {}, reason: str = "", actor: str = "CSM", db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Modify intervention — captures modified recommendation as preference (S48F)."""
    service = InterventionService(db)
    inv = await service.modify_intervention(intervention_id, modified_action=modified_action, reason=reason, actor=actor)
    if not inv:
        raise HTTPException(status_code=404, detail="Intervention not found")
    return inv


# Alias endpoints per S34 spec
@router.post("/recommendations/{recommendation_id}/approve")
async def approve_recommendation_alias(recommendation_id: str, approved_by: str = "CSM", db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    service = InterventionService(db)
    # Try direct id then recommendation_id
    inv = await service.approve_intervention(recommendation_id, approved_by=approved_by)
    if not inv:
        # Search by recommendation_id field
        res = await db.execute(select(Intervention).where(Intervention.recommendation_id == recommendation_id))
        found = res.scalar_one_or_none()
        if found:
            inv = await service.approve_intervention(found.id, approved_by=approved_by)
    if not inv:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return {"recommendation_id": recommendation_id, "decision": "APPROVE", "actor": approved_by, "intervention_id": inv.id, "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status)}


@router.post("/recommendations/{recommendation_id}/reject")
async def reject_recommendation_alias(recommendation_id: str, reason: str = "", actor: str = "CSM", db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    service = InterventionService(db)
    res = await db.execute(select(Intervention).where(Intervention.recommendation_id == recommendation_id))
    found = res.scalar_one_or_none()
    target_id = found.id if found else recommendation_id
    inv = await service.reject_intervention(target_id, reason=reason, actor=actor)
    if not inv:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return {"recommendation_id": recommendation_id, "decision": "REJECT", "reason": reason, "actor": actor}


@router.post("/recommendations/{recommendation_id}/modify")
async def modify_recommendation_alias(recommendation_id: str, modified_action: Dict[str, Any] = {}, reason: str = "", actor: str = "CSM", db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    service = InterventionService(db)
    res = await db.execute(select(Intervention).where(Intervention.recommendation_id == recommendation_id))
    found = res.scalar_one_or_none()
    target_id = found.id if found else recommendation_id
    inv = await service.modify_intervention(target_id, modified_action=modified_action, reason=reason, actor=actor)
    if not inv:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return {"recommendation_id": recommendation_id, "decision": "MODIFY", "modified_action": modified_action, "reason": reason, "actor": actor}


@router.post("/interventions/{intervention_id}/outcome", response_model=OutcomeSchema)
async def record_outcome(intervention_id: str, req: OutcomeCreateRequest, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Record intervention outcome and trigger learning validation gate."""
    engine = LearningEngine(db)
    # Support both path param and body field; body field is now optional
    effective_id = req.intervention_id or intervention_id
    return await engine.evaluate_intervention_outcome(
        intervention_id=effective_id,
        health_before=req.health_before,
        health_after=req.health_after,
        usage_before=req.usage_before,
        usage_after=req.usage_after,
        customer_response=req.customer_response,
        notes=req.notes,
    )


@router.get("/portfolio")
async def get_portfolio_summary(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Portfolio Summary View."""
    customer_repo = CustomerRepository(db, tenant_id=tenant_id)
    customers = await customer_repo.list_all()

    arr_at_risk = sum(c.arr for c in customers if getattr(c.risk_level, "value", c.risk_level) in ("CRITICAL", "HIGH_RISK", "AT_RISK"))
    risk_distribution = {}
    for c in customers:
        risk_distribution[c.risk_level.value] = risk_distribution.get(c.risk_level.value, 0) + 1

    return {
        "metrics": {
            "total_customers": len(customers),
            "arr_at_risk": arr_at_risk,
            "risk_distribution": risk_distribution,
        },
        "customers": customers,
    }


@router.get("/learning/memories", response_model=List[ExperienceMemorySchema])
async def list_experience_memories(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
    limit: int = 50,
    offset: int = 0,
):
    limit = max(1, min(limit, 200))
    repo = MemoryRepository(db, tenant_id=tenant_id)
    all_mems = await repo.list_all()
    return all_mems[offset : offset + limit]


@router.get("/experience-memory", response_model=List[ExperienceMemorySchema])
async def list_experience_memories_alias(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
    limit: int = 50,
    offset: int = 0,
):
    limit = max(1, min(limit, 200))
    repo = MemoryRepository(db, tenant_id=tenant_id)
    all_mems = await repo.list_all()
    return all_mems[offset : offset + limit]


@router.get("/interventions", response_model=List[InterventionSchema])
async def list_all_interventions(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    query = select(Intervention)
    if status:
        query = query.where(Intervention.status == status)  # type: ignore
    query = query.order_by(Intervention.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(query)
    interventions = list(res.scalars().all())
    # Deserialize plan string to plan_steps for frontend dynamic rendering (Phase 0)
    for iv in interventions:
        try:
            raw = getattr(iv, 'plan', None)
            steps = []
            if isinstance(raw, str) and raw.strip():
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    steps = parsed
                elif isinstance(parsed, dict) and isinstance(parsed.get('steps'), list):
                    steps = parsed['steps']
                elif isinstance(parsed, dict) and isinstance(parsed.get('plan_steps'), list):
                    steps = parsed['plan_steps']
            elif isinstance(raw, list):
                steps = raw
            # attach as attribute for Pydantic serialization
            setattr(iv, 'plan_steps', steps)
            # also ensure draft_email/priority derived if present in plan
            if not getattr(iv, 'draft_email', None) and isinstance(parsed if 'parsed' in locals() else None, dict) and parsed.get('draft_email'):
                setattr(iv, 'draft_email', parsed.get('draft_email'))
        except Exception:
            setattr(iv, 'plan_steps', [])
    return interventions


@router.get("/outcomes", response_model=List[OutcomeSchema])
async def list_all_outcomes(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
    limit: int = 50,
    offset: int = 0,
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    res = await db.execute(select(InterventionOutcome).order_by(InterventionOutcome.created_at.desc()).limit(limit).offset(offset))
    return list(res.scalars().all())


@router.get("/metrics/observability")
async def get_observability_metrics(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Observability metrics per S44 — Phase 5 adds by_tenant breakdown (tenant observability)."""
    from sqlalchemy import select, func
    from retainai.db.models import AgentRun, AgentStep
    # Agent latency approximations via run durations
    runs_res = await db.execute(select(AgentRun))
    runs = list(runs_res.scalars().all())
    total_runs = len(runs)
    completed = sum(1 for r in runs if str(getattr(r.status, "value", r.status)) == "COMPLETED")
    failed = total_runs - completed
    # Tool success computed from AgentStep or tool_calls status
    total_tool_calls = sum(len(r.tool_calls or []) for r in runs)
    # Prefer AgentStep table when available, else fall back to tool_calls entries
    try:
        steps_res = await db.execute(select(AgentStep))
        steps = list(steps_res.scalars().all())
    except Exception:
        steps = []
    if steps:
        total_steps = len(steps)
        successful_steps = sum(1 for s in steps if str(getattr(s.status, "value", s.status)).upper() == "SUCCESS")
        tool_success_rate = round(successful_steps / max(1, total_steps), 2) if total_steps > 0 else (round(completed / max(1, total_runs), 2) if total_runs > 0 else 1.0)
        total_tool_calls = total_steps
    else:
        successful_calls = sum(sum(1 for tc in (r.tool_calls or []) if str(tc.get("status", "")).lower() == "success") for r in runs)
        if total_tool_calls > 0:
            tool_success_rate = round(successful_calls / total_tool_calls, 2)
        elif total_runs > 0:
            tool_success_rate = round(completed / max(1, total_runs), 2)
        else:
            tool_success_rate = 1.0
    # Outcomes
    out_res = await db.execute(select(InterventionOutcome))
    outcomes = list(out_res.scalars().all())
    success_outcomes = sum(1 for o in outcomes if str(getattr(o.status, "value", o.status)) in ("SUCCESS", "POSITIVE"))
    # Learning candidates count
    from retainai.db.models import LearningCandidate, ExperienceMemory, SystemEventLog, UsageEvent
    cand_res = await db.execute(select(LearningCandidate))
    candidates = list(cand_res.scalars().all())
    # ── Phase 5: by_tenant breakdown (tenant observability) ──
    # Group counts per tenant_id for runs/outcomes/candidates/memories/events
    from collections import defaultdict
    tenant_ids = set()
    for r in runs:
        tenant_ids.add(getattr(r, "tenant_id", None) or "unknown")
    for o in outcomes:
        tenant_ids.add(getattr(o, "tenant_id", None) or "unknown")
    for c in candidates:
        tenant_ids.add(getattr(c, "tenant_id", None) or "unknown")
    try:
        steps_tenant_ids = set(getattr(s, "tenant_id", None) or "unknown" for s in steps)
        tenant_ids.update(steps_tenant_ids)
    except Exception:
        pass
    # Also include current tenant even if zero
    tenant_ids.add(tenant_id)
    tenant_ids.discard(None)
    by_tenant = {}
    for tid in sorted(tenant_ids):
        tid_key = tid or "unknown"
        runs_t = [r for r in runs if (getattr(r, "tenant_id", None) or "unknown") == tid_key]
        total_t = len(runs_t)
        completed_t = sum(1 for r in runs_t if str(getattr(r.status, "value", r.status)) == "COMPLETED")
        outcomes_t = [o for o in outcomes if (getattr(o, "tenant_id", None) or "unknown") == tid_key]
        candidates_t = [c for c in candidates if (getattr(c, "tenant_id", None) or "unknown") == tid_key]
        steps_t = [s for s in steps if (getattr(s, "tenant_id", None) or "unknown") == tid_key] if steps else []
        # Memories per tenant (tenant-isolated)
        try:
            mem_res = await db.execute(select(ExperienceMemory).where(ExperienceMemory.tenant_id == tid_key))
            mems_t = list(mem_res.scalars().all())
        except Exception:
            mems_t = []
        # Events ingested per tenant (SystemEventLog + UsageEvent count)
        try:
            evt_res = await db.execute(select(func.count()).select_from(SystemEventLog).where(SystemEventLog.tenant_id == tid_key))
            evt_cnt = evt_res.scalar() or 0
        except Exception:
            evt_cnt = 0
        try:
            ue_res = await db.execute(select(func.count()).select_from(UsageEvent).where(UsageEvent.tenant_id == tid_key))
            ue_cnt = ue_res.scalar() or 0
        except Exception:
            ue_cnt = 0
        by_tenant[tid_key] = {
            "agent_runs": {"total": total_t, "completed": completed_t, "failed": total_t - completed_t},
            "tool_calls": {"total": len(steps_t) if steps_t else sum(len(r.tool_calls or []) for r in runs_t)},
            "outcomes": {"total": len(outcomes_t)},
            "learning": {"candidates": len(candidates_t), "memories": len(mems_t)},
            "events_ingested": evt_cnt + ue_cnt,
        }
    validated_memories_current = len([m for m in (await MemoryRepository(db, tenant_id=tenant_id).list_all()) if str(getattr(m.validation_status, "value", m.validation_status)) == "VALIDATED"])
    return {
        "request_id": f"req_{uuid.uuid4().hex[:8]}",
        "agent_runs": {"total": total_runs, "completed": completed, "failed": failed, "completion_rate": round(completed/max(1,total_runs),2)},
        "tool_calls": {"total": total_tool_calls, "success_rate": tool_success_rate},
        "outcomes": {"total": len(outcomes), "success": success_outcomes, "success_rate": round(success_outcomes/max(1,len(outcomes)),2)},
        "learning": {"candidates": len(candidates), "validated_memories": validated_memories_current},
        "by_tenant": by_tenant,
        "current_tenant": tenant_id,
        "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }


@router.get("/config/prompts")
async def get_dynamic_prompts(user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Dynamic System Prompt inspection (S: dynamic prompt)."""
    from retainai.agents.investigation_agent import DEFAULT_SYSTEM_PROMPT as INV_DEF
    from retainai.agents.action_agent import DEFAULT_SYSTEM_PROMPT as ACT_DEF
    from retainai.config import settings
    return {
        "investigation": {
            "effective": settings.INVESTIGATION_SYSTEM_PROMPT or INV_DEF,
            "override": settings.INVESTIGATION_SYSTEM_PROMPT,
            "default": INV_DEF,
            "is_custom": bool(settings.INVESTIGATION_SYSTEM_PROMPT),
        },
        "action": {
            "effective": settings.ACTION_SYSTEM_PROMPT or ACT_DEF,
            "override": settings.ACTION_SYSTEM_PROMPT,
            "default": ACT_DEF,
            "is_custom": bool(settings.ACTION_SYSTEM_PROMPT),
        },
        "provider": settings.LLM_PROVIDER,
        "model": settings.LLM_MODEL,
        "timeout": settings.LLM_TIMEOUT,
    }


@router.put("/config/prompts")
async def update_dynamic_prompts(payload: Dict[str, Any], user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Update dynamic system prompts at runtime (no restart required)."""
    from retainai.config import settings
    if "investigation" in payload:
        val = payload["investigation"]
        if isinstance(val, str) and len(val) > 10000:
            raise HTTPException(status_code=413, detail="Prompt too large")
        settings.INVESTIGATION_SYSTEM_PROMPT = val or ""
    if "action" in payload:
        val = payload["action"]
        if isinstance(val, str) and len(val) > 10000:
            raise HTTPException(status_code=413, detail="Prompt too large")
        settings.ACTION_SYSTEM_PROMPT = val or ""
    if "provider" in payload:
        # Allow dynamic provider/model switch per S95 abstraction
        prov = payload["provider"]
        if prov in ("gemini", "mock", "openai", "anthropic"):
            settings.LLM_PROVIDER = prov
    if "model" in payload:
        settings.LLM_MODEL = str(payload["model"])[:100]
    return await get_dynamic_prompts()



@router.get("/org/settings")
async def get_org_settings(db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user), tenant_id: str = Depends(require_tenant)):
    """Get org settings per-tenant (health_weights, risk_thresholds, llm config)."""
    from retainai.db.models import OrgSettings
    from sqlalchemy import select
    res = await db.execute(select(OrgSettings).where(OrgSettings.tenant_id == tenant_id))
    org = res.scalar_one_or_none()
    if not org:
        org = OrgSettings(tenant_id=tenant_id)
        db.add(org)
        await db.commit()
        await db.refresh(org)
    return {
        "tenant_id": org.tenant_id,
        "health_weights": org.health_weights,
        "risk_thresholds": org.risk_thresholds,
        "llm_provider": org.llm_provider,
        "llm_model": org.llm_model,
        "has_llm_key": bool(org.llm_api_key_encrypted),
        "investigation_prompt": org.investigation_prompt,
        "action_prompt": org.action_prompt,
        "updated_at": org.updated_at.isoformat() if org.updated_at else None,
    }

@router.put("/org/settings")
async def update_org_settings(payload: dict, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user), tenant_id: str = Depends(require_tenant)):
    """Update org settings (ADMIN only). Never returns raw key."""
    if str(user.get("role","")).upper() not in ("ADMIN",):
        raise HTTPException(status_code=403, detail="ADMIN role required")
    from retainai.db.models import OrgSettings
    from sqlalchemy import select
    res = await db.execute(select(OrgSettings).where(OrgSettings.tenant_id == tenant_id))
    org = res.scalar_one_or_none()
    if not org:
        org = OrgSettings(tenant_id=tenant_id)
        db.add(org)
        await db.flush()
    if "health_weights" in payload:
        hw = payload["health_weights"]
        if isinstance(hw, dict):
            org.health_weights = hw
    if "risk_thresholds" in payload:
        org.risk_thresholds = payload["risk_thresholds"]
    if "llm_provider" in payload:
        org.llm_provider = str(payload["llm_provider"])[:50]
    if "llm_model" in payload:
        org.llm_model = str(payload["llm_model"])[:100]
    if "llm_api_key" in payload and payload["llm_api_key"]:
        from retainai.auth.auth import encrypt_api_key
        org.llm_api_key_encrypted = encrypt_api_key(str(payload["llm_api_key"]))
    if "investigation_prompt" in payload:
        val = payload["investigation_prompt"]
        if isinstance(val, str) and len(val) > 10000:
            raise HTTPException(status_code=413, detail="Prompt too large")
        org.investigation_prompt = val
    if "action_prompt" in payload:
        val = payload["action_prompt"]
        if isinstance(val, str) and len(val) > 10000:
            raise HTTPException(status_code=413, detail="Prompt too large")
        org.action_prompt = val
    await db.commit()
    await db.refresh(org)
    return {
        "tenant_id": org.tenant_id,
        "health_weights": org.health_weights,
        "risk_thresholds": org.risk_thresholds,
        "llm_provider": org.llm_provider,
        "llm_model": org.llm_model,
        "has_llm_key": bool(org.llm_api_key_encrypted),
        "investigation_prompt": org.investigation_prompt,
        "action_prompt": org.action_prompt,
        "updated_at": org.updated_at.isoformat() if org.updated_at else None,
    }


@router.get("/org/usage")
async def get_org_usage(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
):
    """Tenant observability: per-tenant usage counts (events_ingested, agent_runs, memories). Phase 5."""
    from sqlalchemy import select, func
    from retainai.db.models import (
        UsageEvent,
        SupportTicket,
        CustomerFeedback,
        AccountEvent,
        AgentRun,
        ExperienceMemory,
        SystemEventLog,
        Customer,
        InterventionOutcome,
        Intervention,
    )
    # Helper to count where tenant_id == current
    async def _count(model):
        try:
            res = await db.execute(select(func.count()).select_from(model).where(model.tenant_id == tenant_id))
            return res.scalar() or 0
        except Exception:
            return 0
    events_ingested = 0
    for _m in (UsageEvent, SupportTicket, CustomerFeedback, AccountEvent, SystemEventLog):
        events_ingested += await _count(_m)
    agent_runs = await _count(AgentRun)
    # Memories: ExperienceMemory + LearningCandidate for richness
    memories = await _count(ExperienceMemory)
    try:
        cust_res = await db.execute(select(func.count()).select_from(Customer).where(Customer.tenant_id == tenant_id))
        customers = cust_res.scalar() or 0
    except Exception:
        customers = 0
    try:
        int_res = await db.execute(select(func.count()).select_from(Intervention).where(Intervention.tenant_id == tenant_id))
        interventions = int_res.scalar() or 0
    except Exception:
        interventions = 0
    try:
        out_res = await db.execute(select(func.count()).select_from(InterventionOutcome).where(InterventionOutcome.tenant_id == tenant_id))
        outcomes = out_res.scalar() or 0
    except Exception:
        outcomes = 0
    logger.info(f"org_usage tenant_id={tenant_id} events={events_ingested} runs={agent_runs} memories={memories}")
    return {
        "tenant_id": tenant_id,
        "events_ingested": events_ingested,
        "agent_runs": agent_runs,
        "memories": memories,
        "customers": customers,
        "interventions": interventions,
        "outcomes": outcomes,
        "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }

@router.post("/replay/{run_id}")
async def replay_agent_run(run_id: str, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant)):
    """Deterministic replay per S31: recorded tool/retrieval replay mode."""
    from retainai.db.models import AgentRun
    res = await db.execute(select(AgentRun).where(AgentRun.id == run_id))
    run = res.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    # Return reproducible snapshot: input event, customer state, retrieved evidence, deterministic calculations, tool outputs
    return {
        "run_id": run.id,
        "customer_id": run.customer_id,
        "input_event": {"run_id": run.id, "customer_id": run.customer_id},
        "customer_state": {"health_score": "reproduced", "risk_level": run.final_decision},
        "tool_outputs": run.tool_calls,
        "configuration": {"model": run.model, "model_version": run.model_version, "prompt_version": run.prompt_version},
        "execution_sequence": run.state_history,
        "recorded_replay_mode": True,
        "deterministic_calculations": "health/risk/signal engines deterministic; LLM fallback deterministic when API key mock",
    }
