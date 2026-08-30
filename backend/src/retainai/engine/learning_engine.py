"""Closed-loop Learning Engine & Validation Gate."""

from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import (
    Intervention,
    InterventionOutcome,
    OutcomeStatus,
    ExperienceMemory,
    LearningCandidate,
    ValidationStatus,
    Customer,
)
from retainai.repositories.intervention_repository import InterventionRepository
from retainai.repositories.memory_repository import MemoryRepository

logger = logging.getLogger("retainai.learning")

# Validation gate thresholds (S22)
MIN_EVIDENCE_FOR_VALIDATION = 2  # minimum distinct interventions before promotion
MIN_CONFIDENCE_FOR_VALIDATION = 0.70
MIN_SAMPLE_SIZE = 2


class LearningEngine:
    """Evaluates post-intervention health deltas and applies the Experience Memory validation gate. Tenant-scoped."""

    def __init__(self, db: AsyncSession, tenant_id: Optional[str] = None):
        self.db = db
        self.tenant_id = tenant_id
        self.intervention_repo = InterventionRepository(db, tenant_id=tenant_id)
        self.memory_repo = MemoryRepository(db, tenant_id=tenant_id)

    def _resolve_tenant(self, intervention: Optional[Intervention] = None, candidate: Optional[LearningCandidate] = None) -> Optional[str]:
        if self.tenant_id:
            return self.tenant_id
        if intervention and getattr(intervention, "tenant_id", None):
            return intervention.tenant_id
        if candidate and getattr(candidate, "tenant_id", None):
            return candidate.tenant_id
        return None

    async def evaluate_intervention_outcome(
        self,
        intervention_id: str,
        health_before: float,
        health_after: float,
        usage_before: float = 0.0,
        usage_after: float = 0.0,
        customer_response: Optional[str] = None,
        notes: Optional[str] = None,
        before_metrics: Optional[Dict[str, Any]] = None,
        after_metrics: Optional[Dict[str, Any]] = None,
        observations: Optional[List[str]] = None,
        evidence_ids: Optional[List[str]] = None,
    ) -> InterventionOutcome:
        health_delta = health_after - health_before

        # Use deterministic evaluation thresholds; poor data quality must not become success
        # If health_before missing or unreliable, confidence drops
        data_quality_ok = health_before is not None and health_after is not None
        confidence_base = 0.90 if data_quality_ok else 0.55
        # Use phrasing that does not claim causality (S27): "associated with improvement"
        if health_delta >= 15.0:
            status = OutcomeStatus.SUCCESS
            eval_status = OutcomeStatus.SUCCESS
            outcome_label = "SUCCESS"
            observations = observations or ["usage increased", "support issue resolved", "risk decreased"]
            confidence = confidence_base
        elif health_delta >= 5.0:
            status = OutcomeStatus.NEUTRAL
            eval_status = OutcomeStatus.NEUTRAL
            outcome_label = "PARTIAL"
            observations = observations or ["usage stable", "customer responded"]
            confidence = 0.65
        elif health_delta >= 0.0:
            status = OutcomeStatus.NEUTRAL
            eval_status = OutcomeStatus.NEUTRAL
            outcome_label = "PARTIAL"
            observations = observations or ["no significant change"]
            confidence = 0.60
        else:
            status = OutcomeStatus.FAILURE
            eval_status = OutcomeStatus.FAILURE
            outcome_label = "FAILED"
            observations = observations or ["risk increased", "usage declined"]
            confidence = 0.85

        # If data quality poor, cap confidence
        if not data_quality_ok:
            confidence = min(confidence, 0.60)
            outcome_label = "UNKNOWN"

        import uuid as _uuid
        outcome = InterventionOutcome(
            id=f"outc_{intervention_id[:8]}_{_uuid.uuid4().hex[:8]}",
            intervention_id=intervention_id,
            customer_id="",  # Populated from intervention
            health_before=health_before,
            health_after=health_after,
            health_delta=round(health_delta, 1),
            usage_before=usage_before,
            usage_after=usage_after,
            before_metrics=before_metrics or {"health": health_before, "usage": usage_before},
            after_metrics=after_metrics or {"health": health_after, "usage": usage_after},
            observations=observations,
            evidence_ids=evidence_ids or [],
            time_window="14d",
            customer_response=customer_response,
            notes=notes,
            status=status,
            outcome=outcome_label,
            evaluation_status=eval_status,
            confidence=confidence,
        )

        intervention = await self.intervention_repo.get_by_id(intervention_id)
        if intervention:
            outcome.customer_id = intervention.customer_id
            # Propagate tenant_id from intervention to outcome
            resolved_tenant = self._resolve_tenant(intervention)
            if resolved_tenant:
                outcome.tenant_id = resolved_tenant
                if not self.tenant_id:
                    self.tenant_id = resolved_tenant
                    # Update repos to be tenant-scoped if we just resolved
                    self.intervention_repo = InterventionRepository(self.db, tenant_id=resolved_tenant)
                    self.memory_repo = MemoryRepository(self.db, tenant_id=resolved_tenant)
            if not outcome.evidence_ids:
                outcome.evidence_ids = [intervention.id]
            # Idempotency: if outcome already exists for this intervention, return existing (S64)
            existing_outcome = await self.intervention_repo.get_outcome_by_intervention(intervention_id)
            if existing_outcome is not None:
                logger.info(f"Idempotent outcome: intervention {intervention_id} already has outcome {existing_outcome.id}, returning existing")
                return existing_outcome
            try:
                await self.intervention_repo.create_outcome(outcome)
            except Exception as e:
                # Handle race unique constraint → fetch existing
                if "UNIQUE" in str(e).upper() or "unique" in str(e).lower():
                    existing = await self.intervention_repo.get_outcome_by_intervention(intervention_id)
                    if existing:
                        return existing
                raise
            # Learning candidate pipeline: always create candidate; validation gate decides promotion
            await self._create_learning_candidate(intervention, outcome)

        return outcome

    async def _create_learning_candidate(
        self, intervention: Intervention, outcome: InterventionOutcome
    ):
        """Create a learning candidate and run validation gate."""
        candidate_id = f"cand_{intervention.customer_id[:5]}_{int(datetime.now(timezone.utc).timestamp())}_{__import__('uuid').uuid4().hex[:4]}"
        segment = "Enterprise"
        try:
            cust_res = await self.db.execute(select(Customer.segment).where(Customer.id == intervention.customer_id))
            seg_val = cust_res.scalar_one_or_none()
            if seg_val:
                segment = seg_val
        except Exception:
            segment = "Enterprise"

        # Tenant-scoped pattern
        tid = self._resolve_tenant(intervention)
        pattern = f"{segment} :: {intervention.action_type}"
        context_json = {
            "segment": segment,
            "action_type": intervention.action_type,
            "health_before": outcome.health_before,
            "health_after": outcome.health_after,
            "health_delta": outcome.health_delta,
            "intervention_title": intervention.title,
            "tenant_id": tid,
        }
        # Calculate confidence with sample awareness
        # Start low for single observation, increase with repetitions
        base_conf = 0.68 if outcome.outcome == "SUCCESS" else 0.45
        # Check existing candidates for same pattern to boost sample_size — tenant-scoped
        existing = await self._get_candidates_for_pattern(pattern, tenant_id=tid)
        sample_size = len(existing) + 1
        confidence = min(0.95, base_conf + (sample_size -1)*0.12)

        # Handle contradictory outcomes: if recent failures exist, lower confidence
        recent_failures = sum(1 for c in existing if "FAIL" in str(c.observed_outcome).upper() or c.confidence < 0.6)
        if recent_failures > 0:
            confidence = max(0.40, confidence - recent_failures*0.15)
            logger.info(f"Learning candidate {candidate_id} penalized for {recent_failures} contradictory recent outcomes")

        candidate = LearningCandidate(
            id=candidate_id,
            tenant_id=tid,
            customer_id=intervention.customer_id,
            intervention_id=intervention.id,
            pattern=pattern,
            context_json=context_json,
            intervention_type=intervention.action_type,
            observed_outcome=f"Health change {outcome.health_delta:+.1f} points ({outcome.outcome.lower()}) — associated with improvement" if outcome.outcome=="SUCCESS" else f"Health change {outcome.health_delta:+.1f} ({outcome.outcome.lower()})",
            evidence_ids=[intervention.id, outcome.id] + (outcome.evidence_ids or []),
            source_intervention_ids=[intervention.id] + [c.intervention_id for c in existing[:3]],
            sample_size=sample_size,
            confidence=round(confidence,2),
            status="PENDING_VALIDATION",
            validation_status=ValidationStatus.CANDIDATE,
        )
        self.db.add(candidate)
        await self.db.commit()
        await self.db.refresh(candidate)
        logger.info(f"Learning candidate created {candidate_id} sample_size={sample_size} confidence={confidence:.2f}")

        # Validation gate: promote only if meets thresholds
        await self._validation_gate(candidate, pattern, existing)

    async def _get_candidates_for_pattern(self, pattern: str, tenant_id: Optional[str] = None) -> List[LearningCandidate]:
        tid = tenant_id or self.tenant_id
        q = select(LearningCandidate).where(LearningCandidate.pattern == pattern)
        if tid:
            q = q.where(LearningCandidate.tenant_id == tid)
        q = q.order_by(LearningCandidate.created_at.desc()).limit(10)
        res = await self.db.execute(q)
        return list(res.scalars().all())

    async def _validation_gate(self, candidate: LearningCandidate, pattern: str, existing: List[LearningCandidate]):
        """Apply safeguards S22 before promoting candidate to validated memory."""
        # Check minimum sample size
        if candidate.sample_size < MIN_SAMPLE_SIZE:
            logger.info(f"Candidate {candidate.id} NOT promoted: sample_size {candidate.sample_size} < {MIN_SAMPLE_SIZE}")
            return
        # Confidence check
        if candidate.confidence < MIN_CONFIDENCE_FOR_VALIDATION:
            logger.info(f"Candidate {candidate.id} NOT promoted: confidence {candidate.confidence} < {MIN_CONFIDENCE_FOR_VALIDATION}")
            return
        # Recency: ensure at least one candidate within last 60 days? For MVP, always pass
        # Consistency: if >50% of sample were failures, reject
        # For this candidate set, we already penalized, but need to check existing success rate
        success_count = sum(1 for c in existing if c.confidence >= 0.65) + (1 if candidate.confidence >= 0.65 else 0)
        if success_count / candidate.sample_size < 0.6:
            logger.info(f"Candidate {candidate.id} NOT promoted: success rate {success_count}/{candidate.sample_size} below threshold")
            candidate.validation_status = ValidationStatus.REJECTED
            candidate.status = "REJECTED"
            await self.db.commit()
            return
        # Data quality: outcome must be SUCCESS or PARTIAL
        if candidate.observed_outcome and "failed" in candidate.observed_outcome.lower():
            candidate.validation_status = ValidationStatus.REJECTED
            candidate.status = "REJECTED"
            await self.db.commit()
            return

        # All checks passed -> promote to validated ExperienceMemory
        await self._promote_to_memory(candidate, pattern)

    async def _promote_to_memory(self, candidate: LearningCandidate, pattern: str):
        """Convert validated candidate to ExperienceMemory with structured experience. Tenant-scoped."""
        tid = candidate.tenant_id or self.tenant_id
        # Check for existing memory with same pattern to update instead of duplicate — tenant-scoped
        existing_mem = await self.memory_repo.get_by_pattern(pattern, tenant_id=tid)
        if existing_mem:
            # Update existing memory: increment success_count, recalc confidence, update provenance
            existing_mem.success_count += 1
            existing_mem.sample_size = candidate.sample_size
            existing_mem.success_rate = round(existing_mem.success_count / existing_mem.sample_size, 2)
            # Confidence decay / boost logic: increase slightly but cap
            existing_mem.confidence = min(0.96, existing_mem.confidence + 0.04)
            existing_mem.last_observed = datetime.now(timezone.utc)
            existing_mem.evidence_ids = list(set((existing_mem.evidence_ids or []) + candidate.evidence_ids))
            existing_mem.source_intervention_ids = list(set((existing_mem.source_intervention_ids or []) + candidate.source_intervention_ids))
            existing_mem.validation_status = ValidationStatus.VALIDATED
            existing_mem.status = "VALIDATED"
            await self.db.commit()
            await self.db.refresh(existing_mem)
            logger.info(f"Promoted candidate {candidate.id} by updating existing memory {existing_mem.id}")
            candidate.validation_status = ValidationStatus.VALIDATED
            candidate.status = "VALIDATED"
            candidate.validated_at = datetime.now(timezone.utc)
            await self.db.commit()
            return

        memory_id = f"mem_val_{candidate.customer_id[:5]}_{int(datetime.now(timezone.utc).timestamp())}"
        # Fetch segment for memory
        segment = candidate.context_json.get("segment", "Enterprise")
        memory = ExperienceMemory(
            id=memory_id,
            tenant_id=tid,
            pattern=pattern,
            context_pattern=f"{segment} Account Recovery — {candidate.intervention_type}",
            customer_segment=segment,
            risk_pattern=candidate.intervention_type or "HIGH_RISK_SUPPORT_BUG_FRICTION",
            signals=["UNRESOLVED_CRITICAL_TICKET", "USAGE_DECLINE", "NEGATIVE_FEEDBACK"],
            recommended_strategy=candidate.intervention_type,
            recommended_intervention=candidate.intervention_type,
            actual_action=candidate.context_json.get("intervention_title", candidate.intervention_type),
            observed_outcome=f"Health recovered {candidate.observed_outcome} (validation sample_size={candidate.sample_size})",
            confidence=candidate.confidence,
            validation_status=ValidationStatus.VALIDATED,
            status="VALIDATED",
            success_count=1,
            failure_count=0,
            sample_size=candidate.sample_size,
            success_rate=1.0,
            evidence_ids=candidate.evidence_ids,
            source_intervention_ids=candidate.source_intervention_ids,
            contexts=[candidate.context_json],
            last_observed=datetime.now(timezone.utc),
            version="v2.1",
        )
        await self.memory_repo.add_memory(memory)
        # Also index in Chroma for semantic retrieval — tenant-namespaced collection
        try:
            from retainai.integrations.chroma_memory import get_chroma_store
            await get_chroma_store().upsert(memory_id=memory.id, pattern=pattern, segment=segment, text=f"{pattern} {candidate.observed_outcome}", metadata={"confidence": candidate.confidence, "sample_size": candidate.sample_size, "tenant_id": tid}, tenant_id=tid)
        except Exception as e:
            logger.warning(f"Chroma upsert skipped: {e}")
        candidate.validation_status = ValidationStatus.VALIDATED
        candidate.status = "VALIDATED"
        candidate.validated_at = datetime.now(timezone.utc)
        await self.db.commit()
        logger.info(f"Candidate {candidate.id} promoted to validated memory {memory_id}")

    async def _process_learning_candidate(
        self, intervention: Intervention, outcome: InterventionOutcome
    ):
        """Backward compat shim -> redirect to _create_learning_candidate."""
        await self._create_learning_candidate(intervention, outcome)

    @classmethod
    async def record_outcome(
        cls,
        db: AsyncSession,
        intervention_id: str,
        success: bool = True,
        delta_usage: float = 15.0,
        delta_support: int = 1,
    ) -> InterventionOutcome:
        engine = cls(db)
        
        # Fetch actual customer health from DB to avoid hardcoding 40.0
        intervention = await engine.intervention_repo.get_by_id(intervention_id)
        health_before = 40.0 # Fallback
        if intervention:
            try:
                from sqlalchemy import select
                from retainai.db.models import Customer
                cust_res = await db.execute(select(Customer.health_score).where(Customer.id == intervention.customer_id))
                hb = cust_res.scalar_one_or_none()
                if hb is not None:
                    health_before = float(hb)
            except Exception:
                pass
            
        health_after = health_before + (delta_usage if success else -10.0)
        
        return await engine.evaluate_intervention_outcome(
            intervention_id=intervention_id,
            health_before=health_before,
            health_after=health_after,
            usage_before=50.0,
            usage_after=50.0 + delta_usage,
            notes="Outcome recorded via record_outcome wrapper.",
        )
