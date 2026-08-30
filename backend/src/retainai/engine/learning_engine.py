"""Closed-loop Learning Engine & Validation Gate."""

from typing import Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from retainai.db.models import (
    Intervention,
    InterventionOutcome,
    OutcomeStatus,
    ExperienceMemory,
    ValidationStatus,
)
from retainai.repositories.intervention_repository import InterventionRepository
from retainai.repositories.memory_repository import MemoryRepository


class LearningEngine:
    """Evaluates post-intervention health deltas and applies the Experience Memory validation gate."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.intervention_repo = InterventionRepository(db)
        self.memory_repo = MemoryRepository(db)

    async def evaluate_intervention_outcome(
        self,
        intervention_id: str,
        health_before: float,
        health_after: float,
        usage_before: float = 0.0,
        usage_after: float = 0.0,
        customer_response: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> InterventionOutcome:
        health_delta = health_after - health_before

        if health_delta >= 15.0:
            status = OutcomeStatus.SUCCESS
            eval_status = OutcomeStatus.SUCCESS
        elif health_delta >= 0.0:
            status = OutcomeStatus.NEUTRAL
            eval_status = OutcomeStatus.NEUTRAL
        else:
            status = OutcomeStatus.FAILURE
            eval_status = OutcomeStatus.FAILURE

        outcome = InterventionOutcome(
            id=f"outc_{intervention_id[:8]}_{int(datetime.now(timezone.utc).timestamp())}",
            intervention_id=intervention_id,
            customer_id="",  # Populated from intervention
            health_before=health_before,
            health_after=health_after,
            health_delta=round(health_delta, 1),
            usage_before=usage_before,
            usage_after=usage_after,
            customer_response=customer_response,
            notes=notes,
            status=status,
            evaluation_status=eval_status,
            confidence=0.90,
        )

        intervention = await self.intervention_repo.get_by_id(intervention_id)
        if intervention:
            outcome.customer_id = intervention.customer_id
            await self.intervention_repo.create_outcome(outcome)

            # Check Validation Gate for Experience Memory Bank
            if status == OutcomeStatus.SUCCESS:
                await self._process_learning_candidate(intervention, outcome)

        return outcome

    async def _process_learning_candidate(
        self, intervention: Intervention, outcome: InterventionOutcome
    ):
        """Validation Gate: Converts successful interventions into validated Experience Memories."""
        memory_id = f"mem_val_{intervention.customer_id[:5]}_{int(datetime.now(timezone.utc).timestamp())}"
        # Dynamic pattern from actual intervention/customer context
        segment = getattr(intervention.customer, "segment", "Enterprise") if getattr(intervention, "customer", None) else "Enterprise"
        memory = ExperienceMemory(
            id=memory_id,
            context_pattern=f"{segment} Account Recovery — {intervention.action_type}",
            customer_segment=segment,
            risk_pattern=intervention.action_type or "HIGH_RISK_SUPPORT_BUG_FRICTION",
            signals=["UNRESOLVED_CRITICAL_TICKET", "USAGE_DECLINE", "NEGATIVE_FEEDBACK"],
            recommended_strategy=intervention.action_type,
            actual_action=intervention.title,
            observed_outcome=f"Health recovered +{outcome.health_delta:.1f} points after intervention ({outcome.customer_response or 'positive signal'}).",
            confidence=0.92,
            validation_status=ValidationStatus.VALIDATED,
            success_count=1,
            failure_count=0,
            evidence_ids=[intervention.id, outcome.id],
        )
        await self.memory_repo.add_memory(memory)

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
        if intervention and intervention.customer:
            health_before = intervention.customer.health_score
            
        health_after = health_before + (delta_usage if success else -10.0)
        
        return await engine.evaluate_intervention_outcome(
            intervention_id=intervention_id,
            health_before=health_before,
            health_after=health_after,
            usage_before=50.0,
            usage_after=50.0 + delta_usage,
            notes="Outcome recorded via record_outcome wrapper.",
        )
