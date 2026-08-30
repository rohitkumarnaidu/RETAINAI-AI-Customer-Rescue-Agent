"""
Migration: Phase 1 Tenancy — Add tenant_id FK indexed (nullable initially) → backfill demo-tenant-001 → SET NOT NULL

Usage:
  uv run python scripts/backfill_tenancy.py                 # SQLite ./retainai.db
  uv run python scripts/backfill_tenancy.py --tenant demo-tenant-001
  DATABASE_URL=postgresql+asyncpg://... uv run python scripts/backfill_tenancy.py

Idempotent: safe to run multiple times.
Rollback: keep nullable flag (no-op) — if needed, DROP COLUMN manually.
"""

import asyncio
import os
import sys
import argparse
from pathlib import Path

# Ensure backend src on path
_BACKEND_SRC = Path(__file__).resolve().parents[1] / "backend" / "src"
if str(_BACKEND_SRC) not in sys.path:
    sys.path.insert(0, str(_BACKEND_SRC))

from sqlalchemy import text

TENANT_TABLES = [
    "customers",
    "usage_events",
    "support_tickets",
    "customer_feedbacks",
    "account_events",
    "risk_assessments",
    "investigation_reports",
    "interventions",
    "intervention_outcomes",
    "experience_memories",
    "learning_candidates",
    "agent_runs",
    "agent_steps",
    "system_event_logs",
    "evidences",
    "feature_adoptions",
]

DEMO_TENANT_ID = os.getenv("DEMO_TENANT_ID", "demo-tenant-001")

async def run_migration(tenant_id: str = DEMO_TENANT_ID, set_not_null: bool = True):
    from retainai.db.session import engine, Base
    from retainai.db.models import Tenant, OrgSettings  # ensure Base has tenants
    # Ensure tables exist (tenants, org_settings, users) via create_all
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print(f"[migrate] Ensured base tables exist (tenants, users, org_settings)")

    # Ensure demo tenant row exists
    async with engine.begin() as conn:
        try:
            res = await conn.execute(text("SELECT id FROM tenants WHERE id=:tid"), {"tid": tenant_id})
            if res.fetchone() is None:
                await conn.execute(text("INSERT INTO tenants (id, name) VALUES (:tid, :name)"), {"tid": tenant_id, "name": "Demo Org (backfilled)"})
                print(f"[migrate] Created tenant {tenant_id}")
            # Ensure org_settings
            res2 = await conn.execute(text("SELECT tenant_id FROM org_settings WHERE tenant_id=:tid"), {"tid": tenant_id})
            if res2.fetchone() is None:
                await conn.execute(text("INSERT INTO org_settings (tenant_id, health_weights, risk_thresholds, llm_provider, llm_model) VALUES (:tid, :hw, :rt, 'groq', 'openai/gpt-oss-120b')"), 
                                   {"tid": tenant_id, "hw": '{"usage":0.4,"support":0.3,"sentiment":0.2,"engagement":0.1}', "rt": '{"critical":20,"high":40,"at_risk":60,"watch":80,"healthy":90}'})
                print(f"[migrate] Created org_settings for {tenant_id}")
        except Exception as e:
            print(f"[warn] ensure tenant failed: {e}")

    is_sqlite = "sqlite" in str(engine.url)
    async with engine.begin() as conn:
        for tbl in TENANT_TABLES:
            try:
                # Check column exists
                if is_sqlite:
                    res = await conn.execute(text(f"PRAGMA table_info('{tbl}')"))
                    cols = [row[1] for row in res.fetchall()]
                    has_col = "tenant_id" in cols
                else:
                    res = await conn.execute(text(f"SELECT column_name FROM information_schema.columns WHERE table_name='{tbl}' AND column_name='tenant_id'"))
                    has_col = res.fetchone() is not None

                if not has_col:
                    print(f"[migrate] {tbl}: ADD COLUMN tenant_id VARCHAR(50) nullable (initially)")
                    if is_sqlite:
                        await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN tenant_id VARCHAR(50)"))
                        try:
                            await conn.execute(text(f"CREATE INDEX IF NOT EXISTS idx_{tbl}_tenant ON {tbl}(tenant_id)"))
                        except Exception:
                            pass
                    else:
                        # Postgres: FK to tenants
                        await conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN tenant_id VARCHAR(50) REFERENCES tenants(id)"))
                        await conn.execute(text(f"CREATE INDEX IF NOT EXISTS idx_{tbl}_tenant ON {tbl}(tenant_id)"))
                else:
                    print(f"[migrate] {tbl}: column tenant_id already exists, skip ADD")

                # Backfill nulls to demo tenant
                if is_sqlite:
                    res = await conn.execute(text(f"SELECT COUNT(*) FROM {tbl} WHERE tenant_id IS NULL"))
                    cnt = res.scalar() or 0
                else:
                    res = await conn.execute(text(f"SELECT COUNT(*) FROM {tbl} WHERE tenant_id IS NULL"))
                    cnt = res.scalar() or 0
                if cnt and cnt > 0:
                    print(f"[migrate] {tbl}: backfilling {cnt} rows → {tenant_id}")
                    await conn.execute(text(f"UPDATE {tbl} SET tenant_id=:tid WHERE tenant_id IS NULL"), {"tid": tenant_id})
                else:
                    print(f"[migrate] {tbl}: no nulls to backfill")

                # SET NOT NULL (Postgres only — SQLite cannot alter column constraint without recreate)
                if set_not_null and not is_sqlite:
                    try:
                        # Verify no nulls remain
                        res = await conn.execute(text(f"SELECT COUNT(*) FROM {tbl} WHERE tenant_id IS NULL"))
                        nulls = res.scalar() or 0
                        if nulls == 0:
                            await conn.execute(text(f"ALTER TABLE {tbl} ALTER COLUMN tenant_id SET NOT NULL"))
                            print(f"[migrate] {tbl}: SET NOT NULL ✅")
                        else:
                            print(f"[migrate] {tbl}: skip SET NOT NULL, {nulls} nulls remain")
                    except Exception as e:
                        print(f"[warn] {tbl} SET NOT NULL failed: {e}")
                elif set_not_null and is_sqlite:
                    print(f"[migrate] {tbl}: SQLite — tenant_id remains nullable at DB level (enforced in app/ORM). For strict NOT NULL, recreate table via alembic or drop_all/create_all.")

            except Exception as e:
                print(f"[error] {tbl} migration failed: {e}")
                continue
    print(f"[done] Tenancy migration complete. Demo tenant: {tenant_id}. Next: restart backend and verify with test_tenancy_isolation.py")
    await engine.dispose()

def main():
    parser = argparse.ArgumentParser(description="Backfill tenancy tenant_id")
    parser.add_argument("--tenant", default=DEMO_TENANT_ID, help="Tenant ID to backfill (default demo-tenant-001)")
    parser.add_argument("--no-not-null", action="store_true", help="Skip SET NOT NULL step")
    args = parser.parse_args()
    asyncio.run(run_migration(tenant_id=args.tenant, set_not_null=not args.no_not_null))

if __name__ == "__main__":
    main()
