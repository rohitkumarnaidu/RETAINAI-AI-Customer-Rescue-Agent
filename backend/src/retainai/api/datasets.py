"""Generic Datasets — any CSV/JSON becomes a queryable dataset, beyond the 4 canonical."""

import uuid
import json
import csv
import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from retainai.db.session import get_db
from retainai.auth.auth import get_current_user, require_tenant
from retainai.db.models import GenericDataset, GenericRecord

router = APIRouter(prefix="/api/v1/datasets", tags=["Generic Datasets"])


def _sanitize_name(name: str) -> str:
    import re
    n = re.sub(r'[^a-zA-Z0-9_]+', '_', name.strip().lower())
    n = re.sub(r'_+', '_', n).strip('_')
    return n[:80] or f"dataset_{uuid.uuid4().hex[:6]}"


@router.post("/upload")
async def upload_generic_dataset(
    file: UploadFile = File(...),
    dataset_name: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
):
    """Upload any CSV as a generic dataset — arbitrary headers, any columns."""
    if not file.filename or not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files supported for generic datasets")
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 2MB)")
    try:
        text = content.decode('utf-8')
    except:
        text = content.decode('latin-1')
    lines = [l for l in text.splitlines() if l.strip()]
    if len(lines) < 1:
        raise HTTPException(status_code=400, detail="CSV empty")
    # robust parse
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV missing header row")
    headers = [h.strip() for h in reader.fieldnames if h.strip()]
    if not headers:
        raise HTTPException(status_code=400, detail="No valid headers")
    rows: List[Dict[str, str]] = []
    for row in reader:
        # normalize keys
        clean = { (k or '').strip(): (v or '').strip() for k, v in row.items() if k }
        if any(clean.values()):
            rows.append(clean)
    if len(rows) > 2000:
        raise HTTPException(status_code=400, detail="Too many rows (max 2000 for generic datasets)")
    if len(rows) == 0:
        raise HTTPException(status_code=400, detail="CSV has no data rows")
    # dataset_name from form or filename
    base = dataset_name or file.filename.rsplit('.',1)[0]
    ds_name = _sanitize_name(base)
    # ensure unique per tenant
    existing = await db.execute(select(GenericDataset).where(GenericDataset.tenant_id == tenant_id).where(GenericDataset.dataset_name == ds_name).limit(1))
    if existing.scalar_one_or_none():
        ds_name = f"{ds_name}_{uuid.uuid4().hex[:4]}"
    ds = GenericDataset(
        id=f"ds_{uuid.uuid4().hex[:8]}",
        tenant_id=tenant_id,
        dataset_name=ds_name,
        filename=file.filename,
        headers=headers,
        row_count=len(rows),
        size_kb=len(content)/1024,
    )
    db.add(ds)
    await db.flush()
    # store records
    for idx, r in enumerate(rows):
        # try to link customer if any column looks like customer_id/name
        cust_id = None
        for k in ['customer_id','customer','cust_id','account_id','id_customer','customer_name','company','account']:
            if k in r and r[k]:
                # naive: if value matches a customer id in this tenant, link it
                cust_id = r[k][:50]
                break
        rec = GenericRecord(
            id=f"rec_{uuid.uuid4().hex[:8]}",
            tenant_id=tenant_id,
            dataset_id=ds.id,
            dataset_name=ds_name,
            customer_id=cust_id,
            row_data=r,
            row_index=idx,
        )
        db.add(rec)
    await db.commit()
    return {"dataset_id": ds.id, "dataset_name": ds_name, "headers": headers, "rows": len(rows), "size_kb": round(len(content)/1024,1)}


@router.get("")
async def list_datasets(
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
):
    """List all datasets for tenant — 4 canonical + any generic."""
    # canonical 4 are always present (counts from canonical tables)
    from retainai.db.models import Customer, UsageEvent, SupportTicket, CustomerFeedback
    # count canonical
    def _count(model):
        return func.count(model.id)
    # quick counts
    c_res = await db.execute(select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id))
    cust_cnt = c_res.scalar() or 0
    u_res = await db.execute(select(func.count(UsageEvent.id)).where(UsageEvent.tenant_id == tenant_id))
    usage_cnt = u_res.scalar() or 0
    s_res = await db.execute(select(func.count(SupportTicket.id)).where(SupportTicket.tenant_id == tenant_id))
    supp_cnt = s_res.scalar() or 0
    f_res = await db.execute(select(func.count(CustomerFeedback.id)).where(CustomerFeedback.tenant_id == tenant_id))
    feed_cnt = f_res.scalar() or 0

    canonical = [
        {"dataset_name": "customers", "display": "Customers", "rows": cust_cnt, "headers": ["name","domain","segment","industry","plan","arr","mrr","csm_name","csm_email","health_score","risk_level","renewal_date","status"], "type": "canonical", "icon": "users"},
        {"dataset_name": "usage_events", "display": "Usage", "rows": usage_cnt, "headers": ["timestamp","source","title","description"], "type": "canonical", "icon": "activity"},
        {"dataset_name": "support_tickets", "display": "Support", "rows": supp_cnt, "headers": ["timestamp","source","title","description"], "type": "canonical", "icon": "lifebuoy"},
        {"dataset_name": "customer_feedbacks", "display": "Feedback", "rows": feed_cnt, "headers": ["timestamp","source","title","description"], "type": "canonical", "icon": "message"},
    ]
    # generic
    g_res = await db.execute(select(GenericDataset).where(GenericDataset.tenant_id == tenant_id).order_by(GenericDataset.created_at.desc()))
    generic = []
    for ds in g_res.scalars().all():
        generic.append({"dataset_id": ds.id, "dataset_name": ds.dataset_name, "display": ds.dataset_name.replace('_',' ').title(), "rows": ds.row_count, "headers": ds.headers, "filename": ds.filename, "size_kb": ds.size_kb, "created_at": ds.created_at.isoformat() if ds.created_at else None, "type": "generic", "icon": "database"})
    return {"canonical": canonical, "generic": generic, "total": len(canonical) + len(generic)}


@router.get("/{dataset_name}/records")
async def get_dataset_records(
    dataset_name: str,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
    limit: int = 50,
    offset: int = 0,
    search: str = "",
):
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    # check if canonical
    if dataset_name in ("customers","usage_events","support_tickets","customer_feedbacks","usage","support","feedback","customers_db"):
        # map aliases
        alias = {"customers":"customers","usage":"usage_events","support":"support_tickets","feedback":"customer_feedbacks","customers_db":"customers"}.get(dataset_name, dataset_name)
        if alias == "customers":
            from retainai.db.models import Customer
            q = select(Customer).where(Customer.tenant_id == tenant_id)
            if search:
                q = q.where(Customer.name.ilike(f"%{search}%"))
            q = q.order_by(Customer.created_at.desc()).limit(limit).offset(offset)
            res = await db.execute(q)
            rows = []
            for c in res.scalars().all():
                rows.append({k: getattr(c, k) for k in ["id","name","domain","segment","industry","plan","arr","health_score","risk_level"] if hasattr(c,k)})
            return {"dataset_name": dataset_name, "rows": rows, "total": len(rows)}
        # for others, use generic timeline via telemetry repo? For now, return via Generic fallback using timeline
        # fallback: query generic tables or use timeline
        from retainai.db.models import UsageEvent, SupportTicket, CustomerFeedback
        model_map = {"usage_events": UsageEvent, "support_tickets": SupportTicket, "customer_feedbacks": CustomerFeedback}
        model = model_map.get(alias)
        if model:
            q = select(model).where(model.tenant_id == tenant_id).order_by(model.id.desc()).limit(limit).offset(offset)
            if search:
                # naive search on id
                q = select(model).where(model.tenant_id == tenant_id).where(model.id.ilike(f"%{search}%")).limit(limit).offset(offset)
            res = await db.execute(q)
            rows = [{k: str(getattr(o,k))[:200] for k in o.__dict__ if not k.startswith('_')} for o in res.scalars().all()]
            return {"dataset_name": dataset_name, "rows": rows}
    # generic
    ds_res = await db.execute(select(GenericDataset).where(GenericDataset.tenant_id == tenant_id).where(GenericDataset.dataset_name == dataset_name).limit(1))
    ds = ds_res.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_name} not found")
    q = select(GenericRecord).where(GenericRecord.tenant_id == tenant_id).where(GenericRecord.dataset_name == dataset_name)
    if search:
        # search in row_data json: naive ilike on cast? For sqlite, just filter in python after fetch
        q = q.order_by(GenericRecord.row_index).limit(500)
        res = await db.execute(q)
        all_rows = list(res.scalars().all())
        needle = search.lower()
        filtered = [r for r in all_rows if needle in json.dumps(r.row_data).lower()]
        paged = filtered[offset:offset+limit]
        return {"dataset_name": dataset_name, "headers": ds.headers, "rows": [r.row_data for r in paged], "total": len(filtered)}
    else:
        q = q.order_by(GenericRecord.row_index).limit(limit).offset(offset)
        res = await db.execute(q)
        rows = [r.row_data for r in res.scalars().all()]
        return {"dataset_name": dataset_name, "headers": ds.headers, "rows": rows, "total": ds.row_count}


@router.delete("/{dataset_name}")
async def delete_dataset(
    dataset_name: str,
    db: AsyncSession = Depends(get_db),
    user: Dict[str, Any] = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
):
    if dataset_name in ("customers","usage_events","support_tickets","customer_feedbacks"):
        raise HTTPException(status_code=400, detail="Cannot delete canonical dataset — use Data Hub folders")
    ds_res = await db.execute(select(GenericDataset).where(GenericDataset.tenant_id == tenant_id).where(GenericDataset.dataset_name == dataset_name).limit(1))
    ds = ds_res.scalar_one_or_none()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    await db.execute(delete(GenericRecord).where(GenericRecord.dataset_id == ds.id))
    await db.execute(delete(GenericDataset).where(GenericDataset.id == ds.id))
    await db.commit()
    return {"deleted": dataset_name}
