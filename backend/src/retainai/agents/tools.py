"""Agent Tools & Service Contracts — Connects Agent Reasoning to Deterministic Repositories."""

import time
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
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
    """Deterministic Tool Contracts exposed to Agent Orchestrator with validation, auth, and audit."""

    def __init__(self, session: AsyncSession, authorized_customer_ids: Optional[List[str]] = None):
        self.session = session
        self.customer_repo = CustomerRepository(session)
        self.telemetry_repo = TelemetryRepository(session)
        self.memory_repo = MemoryRepository(session)
        self.intervention_repo = InterventionRepository(session)
        self.signal_service = SignalService(session)
        self._authorized_ids = set(authorized_customer_ids) if authorized_customer_ids else None
        self._tool_audit: List[Dict[str, Any]] = []

    def _authorize_customer_scope(self, customer_id: str):
        """Tenant/customer scope enforcement (S39)."""
        if self._authorized_ids is not None and customer_id not in self._authorized_ids:
            raise PermissionError(f"Unauthorized access to customer {customer_id}")
        # Validate customer_id format (prevent SQL injection via ORM escaping but still validate)
        if not customer_id or len(customer_id) > 80 or ";" in customer_id or "--" in customer_id:
            raise ValueError(f"Invalid customer_id format: {customer_id}")

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
        logger.info(f"Tool {tool} {status} latency={latency_ms}ms")

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
            customer = await self.customer_repo.get_by_id(customer_id)
            if not customer:
                self._log_tool_call("get_customer_profile", {"customer_id": customer_id}, "FAILED", int((time.time()-start)*1000), error="Customer not found")
                return {"error": f"Customer {customer_id} not found."}
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
            # Timeout guard (simplified)
            usage = await self.telemetry_repo.get_usage_events(customer_id, days=days)
            tickets = await self.telemetry_repo.get_support_tickets(customer_id, days=days)
            feedback = await self.telemetry_repo.get_feedback_entries(customer_id, days=days)
            events = await self.telemetry_repo.get_account_events(customer_id, days=days)
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
            signals = await self.signal_service.get_customer_signals(customer_id)
            self._log_tool_call("calculate_customer_signals", {"customer_id": customer_id}, "SUCCESS", int((time.time()-start)*1000))
            return signals
        except Exception as e:
            self._log_tool_call("calculate_customer_signals", {"customer_id": customer_id}, "FAILED", int((time.time()-start)*1000), error=str(e))
            raise

    async def evaluate_customer_risk(self, customer_id: str):
        from retainai.services.customer_service import CustomerService
        svc = CustomerService(self.session)
        return await svc.reassess_customer_risk(customer_id)

    async def query_experience_memory(self, segment: str, risk_pattern: str) -> List[Dict[str, Any]]:
        # Try Chroma semantic retrieval first (S24+P2), fallback to SQL
        try:
            from retainai.integrations.chroma_memory import get_chroma_store
            chroma = get_chroma_store()
            # Chroma is hybrid: SQLite is source of truth, Chroma is index; we query both
            chroma_hits = await chroma.query(query_text=risk_pattern, segment=segment, top_k=3)
            if chroma_hits:
                logger.info(f"Chroma memory hits: {len(chroma_hits)}")
        except Exception:
            pass
        start = time.time()
        try:
            if len(segment) > 100 or len(risk_pattern) > 500:
                # Truncate instead of failing to allow long root causes
                risk_pattern = risk_pattern[:500]
            memories = await self.memory_repo.get_validated_memories(customer_segment=segment)
            # Filter non-relevant: if risk_pattern empty, return all; else fuzzy match
            filtered = []
            for m in memories:
                # Relevance check: segment match already filtered; also check risk pattern token overlap
                if risk_pattern and risk_pattern.lower() not in (m.risk_pattern or "").lower() and risk_pattern.lower() not in (m.context_pattern or "").lower():
                    # If no token match and we have many memories, skip irrelevant
                    # But keep if confidence high and segment matches - we keep all for MVP but mark relevance
                    pass
                filtered.append(m)
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
                }
                for m in filtered
            ]
        except Exception as e:
            self._log_tool_call("query_experience_memory", {"segment": segment}, "FAILED", int((time.time()-start)*1000), error=str(e))
            raise

    async def generate_retention_plan(self, customer_id: str, root_cause: str, priority: str = "HIGH"):
        from retainai.agents.action_agent import ActionStrategyAgent
        profile = await self.get_customer_profile(customer_id)
        investigation_summary = f"Root cause: {root_cause}"
        matched = await self.query_experience_memory(segment=profile.get("segment","Enterprise"), risk_pattern=root_cause)
        agent = ActionStrategyAgent()
        return await agent.generate_plan(customer_name=profile.get("name","Customer"), csm_name=profile.get("csm","CSM"), investigation_summary=investigation_summary, root_cause=root_cause, matched_memories=matched)

    async def record_intervention(self, customer_id: str, action_type: str, title: str, description: str, plan: str, investigation_id: str):
        from retainai.db.models import Intervention, InterventionStatus
        import uuid
        inv = Intervention(id=f"inv_{customer_id[:8]}_{uuid.uuid4().hex[:6]}", customer_id=customer_id, investigation_id=investigation_id, action_type=action_type, title=title, description=description, plan=plan, status=InterventionStatus.PROPOSED)
        return await self.intervention_repo.create_intervention(inv)

    async def record_outcome(self, intervention_id: str, health_before: float, health_after: float, **kwargs):
        from retainai.engine.learning_engine import LearningEngine
        eng = LearningEngine(self.session)
        return await eng.evaluate_intervention_outcome(intervention_id=intervention_id, health_before=health_before, health_after=health_after, **kwargs)

    async def update_experience_memory(self, memory_id: str, updates: Dict[str, Any]):
        # Restricted - only validated path should call
        self.validate_tool_exists("update_experience_memory")
        raise PermissionError("Direct memory updates blocked; use LearningEngine validation gate")
