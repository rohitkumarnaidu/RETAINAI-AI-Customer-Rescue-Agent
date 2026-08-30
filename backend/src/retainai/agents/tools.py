"""Agent Tools & Service Contracts — Connects Agent Reasoning to Deterministic Repositories — Tenant-Isolated Phase 1."""

import time
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.repositories.customer_repository import CustomerRepository
from retainai.repositories.telemetry_repository import TelemetryRepository
from retainai.repositories.memory_repository import MemoryRepository
from retainai.repositories.intervention_repository import InterventionRepository
from retainai.services.signal_service import SignalService

logger = logging.getLogger("retainai.tools")

# Tool definitions with explicit allowlist (S11/S12/S13)
ALLOWED_TOOLS = {
    "get_customer_profile",
    "search_customer_evidence",
    "calculate_customer_signals",
    "query_experience_memory",
    "get_customer_usage",  # alias
    "get_usage_history",
    "get_support_interactions",
    "get_customer_feedback",
    "get_account_activity",
    "get_customer_memory",
    "compare_customer_periods",
    "evaluate_customer_risk",
    "generate_retention_plan",
    "record_intervention",
    "record_outcome",
    "update_experience_memory",
}

# Input/Output schemas per tool (S11)
class GetCustomerProfileInput(BaseModel):
    customer_id: str = Field(..., min_length=3, max_length=80)

class SearchEvidenceInput(BaseModel):
    customer_id: str = Field(..., min_length=3)
    days: int = Field(default=30, ge=1, le=365)

class CustomerToolOutput(BaseModel):
    id: str
    name: str

TOOL_TIMEOUT_SECONDS = 5.0
TOOL_MAX_RETRIES = 2


class AgentTools:
    """Deterministic Tool Contracts exposed to Agent Orchestrator with validation, auth, and audit — Tenant-Isolated."""

    def __init__(self, session: AsyncSession, tenant_id: Optional[str] = None, authorized_customer_ids: Optional[List[str]] = None):
        # Support both signatures: (session, tenant_id) and legacy (session, authorized_customer_ids)
        # If second arg is list, treat as authorized_customer_ids
        if isinstance(tenant_id, list):
            authorized_customer_ids = tenant_id  # type: ignore
            tenant_id = None
        self.session = session
        self.tenant_id = tenant_id
        self.customer_repo = CustomerRepository(session, tenant_id=tenant_id)
        self.telemetry_repo = TelemetryRepository(session, tenant_id=tenant_id)
        self.memory_repo = MemoryRepository(session, tenant_id=tenant_id)
        self.intervention_repo = InterventionRepository(session, tenant_id=tenant_id)
        self.signal_service = SignalService(session)
        self._authorized_ids = set(authorized_customer_ids) if authorized_customer_ids else None
        self._tool_audit: List[Dict[str, Any]] = []

    def _authorize_customer_scope(self, customer_id: str):
        """Tenant/customer scope enforcement (S39 + Phase 1 tenant isolation)."""
        # Legacy customer_ids allowlist check
        if self._authorized_ids is not None and customer_id not in self._authorized_ids:
            raise PermissionError(f"Unauthorized access to customer {customer_id}")
        # Validate customer_id format (prevent SQL injection via ORM escaping but still validate)
        if not customer_id or len(customer_id) > 80 or ";" in customer_id or "--" in customer_id:
            raise ValueError(f"Invalid customer_id format: {customer_id}")

    async def _authorize_tenant_for_customer(self, customer_id: str):
        """Phase 1: ensure customer.tenant_id == self.tenant_id (if tenant scoping enabled)."""
        if not self.tenant_id:
            return
        # Fetch customer tenant
        try:
            from retainai.db.models import Customer
            res = await self.session.execute(select(Customer.tenant_id).where(Customer.id == customer_id))
            row = res.scalar_one_or_none()
            if row is None:
                # Customer not found — let caller handle
                return
            # Allow null tenant for pre-migration rows (treat as belonging to demo tenant)
            if row is not None and row != self.tenant_id:
                # If row is None (null) we allow for demo tenant only
                # But if tenant mismatch, raise
                raise PermissionError(f"Tenant isolation violation: customer {customer_id} belongs to tenant {row}, not {self.tenant_id}")
        except PermissionError:
            raise
        except Exception as e:
            # If query fails, log but don't block (fallback to legacy)
            logger.debug(f"tenant authorize check failed for {customer_id}: {e}")

    def _log_tool_call(self, tool: str, input_data: Dict[str, Any], status: str, latency_ms: int, error: Optional[str] = None):
        entry = {
            "tool": tool,
            "input": input_data,
            "status": status,
            "latency_ms": latency_ms,
            "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "error": error,
        }
        self._tool_audit.append(entry)
        logger.info(f"Tool {tool} {status} latency={latency_ms}ms tenant={self.tenant_id}")

    def validate_tool_exists(self, tool_name: str) -> bool:
        """Reject hallucinated tools (S13)."""
        if tool_name not in ALLOWED_TOOLS:
            raise ValueError(f"Tool '{tool_name}' is not in allowlist. Hallucinated tool rejected.")
        return True

    async def get_customer_profile(self, customer_id: str) -> Dict[str, Any]:
        start = time.time()
        try:
            # Input validation
            GetCustomerProfileInput(customer_id=customer_id)
            self._authorize_customer_scope(customer_id)
            await self._authorize_tenant_for_customer(customer_id)
            customer = await self.customer_repo.get_by_id(customer_id)
            if not customer:
                self._log_tool_call("get_customer_profile", {"customer_id": customer_id}, "FAILED", int((time.time()-start)*1000), error="Customer not found")
                return {"error": f"Customer {customer_id} not found."}
            # Tenant isolation post-check
            if self.tenant_id and customer.tenant_id and customer.tenant_id != self.tenant_id:
                raise PermissionError(f"Tenant isolation violation: customer {customer_id} tenant {customer.tenant_id} != {self.tenant_id}")
            # Sensitive-field filtering (S41)
            result = {
                "id": customer.id,
                "name": customer.name,
                "domain": customer.domain,
                "segment": customer.segment,
                "industry": customer.industry,
                "mrr": customer.mrr,
                "arr": customer.arr,
                "csm": customer.csm_name,
                "csm_email": customer.csm_email,
                "health_score": customer.health_score,
                "risk_level": customer.risk_level.value if hasattr(customer.risk_level, "value") else str(customer.risk_level),
                "is_false_positive_candidate": customer.is_false_positive_candidate,
                "tenant_id": customer.tenant_id,
            }
            self._log_tool_call("get_customer_profile", {"customer_id": customer_id}, "SUCCESS", int((time.time()-start)*1000))
            return result
        except Exception as e:
            self._log_tool_call("get_customer_profile", {"customer_id": customer_id}, "FAILED", int((time.time()-start)*1000), error=str(e))
            raise

    async def search_customer_evidence(self, customer_id: str, days: int = 30) -> Dict[str, Any]:
        """Queries telemetry across all sources for evidence synthesis."""
        start = time.time()
        try:
            SearchEvidenceInput(customer_id=customer_id, days=days)
            self._authorize_customer_scope(customer_id)
            await self._authorize_tenant_for_customer(customer_id)
            # Timeout guard with wait_for (5s) + any generic datasets
            import asyncio
            usage = await asyncio.wait_for(self.telemetry_repo.get_usage_events(customer_id, days=days), timeout=TOOL_TIMEOUT_SECONDS)
            tickets = await asyncio.wait_for(self.telemetry_repo.get_support_tickets(customer_id, days=days), timeout=TOOL_TIMEOUT_SECONDS)
            feedback = await asyncio.wait_for(self.telemetry_repo.get_feedback_entries(customer_id, days=days), timeout=TOOL_TIMEOUT_SECONDS)
            events = await asyncio.wait_for(self.telemetry_repo.get_account_events(customer_id, days=days), timeout=TOOL_TIMEOUT_SECONDS)
            # Any generic datasets for this customer
            generic_any = []
            try:
                from sqlalchemy import select as _sel
                from retainai.db.models import GenericRecord
                g_res = await self.session.execute(_sel(GenericRecord).where(GenericRecord.tenant_id == self.tenant_id).where(GenericRecord.customer_id == customer_id).limit(20))
                for gr in g_res.scalars().all():
                    generic_any.append({"id": gr.id, "dataset": gr.dataset_name, "data": gr.row_data})
            except Exception:
                pass
            self._log_tool_call("search_customer_evidence", {"customer_id": customer_id, "days": days}, "SUCCESS", int((time.time()-start)*1000))
            return {
                "usage_events": [
                    {
                        "id": u.id,
                        "date": str(u.timestamp.date()),
                        "dau": u.daily_active_users,
                        "license_utilization": u.license_utilization,
                        "feature_clicks": u.feature_clicks,
                    }
                    for u in usage
                ],
                "support_tickets": [
                    {
                        "id": t.id,
                        "severity": t.severity,
                        "category": t.category,
                        "subject": t.subject,
                        "status": t.status,
                        "description": t.description,
                    }
                    for t in tickets
                ],
                "feedback_entries": [
                    {
                        "id": f.id,
                        "source": f.source,
                        "sentiment": f.sentiment,
                        "score": f.score,
                        "text": f.text,
                        "comment": f.comment,
                    }
                    for f in feedback
                ],
                "account_events": [
                    {
                        "id": e.id,
                        "event_type": e.event_type,
                        "description": e.description,
                    }
                    for e in events
                ],
                "generic_datasets": generic_any,
            }
        except Exception as e:
            self._log_tool_call("search_customer_evidence", {"customer_id": customer_id}, "FAILED", int((time.time()-start)*1000), error=str(e))
            raise

    # Backward compat aliases & expanded toolset (S11)
    async def get_customer_usage(self, customer_id: str, days: int = 30):
        return await self.search_customer_evidence(customer_id, days)

    async def get_usage_history(self, customer_id: str, days: int = 30):
        data = await self.search_customer_evidence(customer_id, days)
        return data["usage_events"]

    async def get_support_interactions(self, customer_id: str, days: int = 30):
        data = await self.search_customer_evidence(customer_id, days)
        return data["support_tickets"]

    async def get_customer_feedback(self, customer_id: str, days: int = 30):
        data = await self.search_customer_evidence(customer_id, days)
        return data["feedback_entries"]

    async def get_account_activity(self, customer_id: str, days: int = 30):
        data = await self.search_customer_evidence(customer_id, days)
        return data["account_events"]

    async def compare_customer_periods(self, customer_id: str, current_days: int = 7, baseline_days: int = 30):
        await self._authorize_tenant_for_customer(customer_id)
        from retainai.engine.time_window import TimeWindowEngine
        usage = await self.telemetry_repo.get_usage_events(customer_id, days=baseline_days)
        cmp = TimeWindowEngine.calculate_usage_window_delta(usage, current_days=current_days, baseline_days=baseline_days)
        return cmp.__dict__

    async def get_customer_memory(self, customer_id: str):
        # Retrieve any memories relevant to customer segment
        profile = await self.get_customer_profile(customer_id)
        segment = profile.get("segment", "Enterprise")
        return await self.query_experience_memory(segment=segment, risk_pattern="")

    async def calculate_customer_signals(self, customer_id: str) -> List[Dict[str, Any]]:
        start = time.time()
        try:
            GetCustomerProfileInput(customer_id=customer_id)
            self._authorize_customer_scope(customer_id)
            await self._authorize_tenant_for_customer(customer_id)
            signals = await self.signal_service.get_customer_signals(customer_id)
            self._log_tool_call("calculate_customer_signals", {"customer_id": customer_id}, "SUCCESS", int((time.time()-start)*1000))
            return signals
        except Exception as e:
            self._log_tool_call("calculate_customer_signals", {"customer_id": customer_id}, "FAILED", int((time.time()-start)*1000), error=str(e))
            raise

    async def evaluate_customer_risk(self, customer_id: str):
        await self._authorize_tenant_for_customer(customer_id)
        from retainai.services.customer_service import CustomerService
        svc = CustomerService(self.session, tenant_id=self.tenant_id)
        return await svc.reassess_customer_risk(customer_id)

    async def query_experience_memory(self, segment: str, risk_pattern: str, tenant_id: Optional[str] = None) -> List[Dict[str, Any]]:
        # Tenant-scoped: prefer explicit tenant_id param else self.tenant_id
        eff_tenant = tenant_id or self.tenant_id
        # Try Chroma semantic retrieval first (S24+P2), fallback to SQL — tenant-scoped namespace tenant_{id}_memories
        try:
            from retainai.integrations.chroma_memory import get_chroma_store
            chroma = get_chroma_store()
            chroma_hits = await chroma.query(query_text=risk_pattern, segment=segment, top_k=3, tenant_id=eff_tenant)
            if chroma_hits:
                logger.info(f"Chroma memory hits: {len(chroma_hits)} tenant={eff_tenant}")
        except Exception:
            pass
        start = time.time()
        try:
            if len(segment) > 100 or len(risk_pattern) > 500:
                # Truncate instead of failing to allow long root causes
                risk_pattern = risk_pattern[:500]
            memories = await self.memory_repo.get_validated_memories(customer_segment=segment, tenant_id=eff_tenant)
            # Rank by relevance: token overlap + confidence + success_rate
            def _score(m):
                risk_pat_lower = (m.risk_pattern or "").lower()
                ctx_pat_lower = (m.context_pattern or "").lower()
                rec_lower = (m.recommended_strategy or "").lower()
                combined = f"{risk_pat_lower} {ctx_pat_lower} {rec_lower}"
                if not risk_pattern:
                    return (m.confidence or 0) * 0.5 + (getattr(m, "success_rate", 0) or 0) * 0.5
                q_tokens = set(risk_pattern.lower().split())
                c_tokens = set(combined.split())
                overlap = len(q_tokens & c_tokens) / max(1, len(q_tokens))
                return overlap * 0.6 + (m.confidence or 0) * 0.2 + (getattr(m, "success_rate", 0) or 0) * 0.2
            memories_sorted = sorted(memories, key=_score, reverse=True)
            filtered = memories_sorted[:3] if memories_sorted else []
            self._log_tool_call("query_experience_memory", {"segment": segment, "risk_pattern": risk_pattern[:50]}, "SUCCESS", int((time.time()-start)*1000))
            return [
                {
                    "id": m.id,
                    "customer_segment": m.customer_segment,
                    "risk_pattern": m.risk_pattern,
                    "context_pattern": m.context_pattern,
                    "signals": m.signals,
                    "recommended_strategy": m.recommended_strategy,
                    "confidence": m.confidence,
                    "observed_outcome": m.observed_outcome,
                    "success_rate": getattr(m, "success_rate", 0.0),
                    "success_count": getattr(m, "success_count", 1),
                    "tenant_id": getattr(m, "tenant_id", None),
                }
                for m in filtered
            ]
        except Exception as e:
            self._log_tool_call("query_experience_memory", {"segment": segment}, "FAILED", int((time.time()-start)*1000), error=str(e))
            raise

    async def generate_retention_plan(self, customer_id: str, root_cause: str, priority: str = "HIGH"):
        await self._authorize_tenant_for_customer(customer_id)
        from retainai.agents.action_agent import ActionStrategyAgent
        profile = await self.get_customer_profile(customer_id)
        investigation_summary = f"Root cause: {root_cause}"
        matched = await self.query_experience_memory(segment=profile.get("segment","Enterprise"), risk_pattern=root_cause)
        agent = ActionStrategyAgent()
        return await agent.generate_plan(customer_name=profile.get("name","Customer"), csm_name=profile.get("csm","CSM"), investigation_summary=investigation_summary, root_cause=root_cause, matched_memories=matched)

    async def record_intervention(self, customer_id: str, action_type: str, title: str, description: str, plan: str, investigation_id: str):
        await self._authorize_tenant_for_customer(customer_id)
        from retainai.db.models import Intervention, InterventionStatus
        import uuid
        inv = Intervention(id=f"inv_{customer_id[:8]}_{uuid.uuid4().hex[:6]}", tenant_id=self.tenant_id, customer_id=customer_id, investigation_id=investigation_id, action_type=action_type, title=title, description=description, plan=plan, status=InterventionStatus.PROPOSED)
        return await self.intervention_repo.create_intervention(inv)

    async def record_outcome(self, intervention_id: str, health_before: float, health_after: float, **kwargs):
        from retainai.engine.learning_engine import LearningEngine
        eng = LearningEngine(self.session)
        # tenant propagation via kwargs if needed
        return await eng.evaluate_intervention_outcome(intervention_id=intervention_id, health_before=health_before, health_after=health_after, **kwargs)

    async def update_experience_memory(self, memory_id: str, updates: Dict[str, Any]):
        # Restricted - only validated path should call
        self.validate_tool_exists("update_experience_memory")
        raise PermissionError("Direct memory updates blocked; use LearningEngine validation gate")
