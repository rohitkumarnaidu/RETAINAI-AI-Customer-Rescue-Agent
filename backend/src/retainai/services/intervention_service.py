"""Intervention Service for lifecycle action management."""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from retainai.db.models import Intervention, InterventionStatus, SystemEventLog
from retainai.repositories.intervention_repository import InterventionRepository
import uuid

# Human feedback becomes learning signal (S15)


class InterventionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.intervention_repo = InterventionRepository(db)

    async def get_customer_interventions(self, customer_id: str) -> List[Intervention]:
        return await self.intervention_repo.get_customer_interventions(customer_id)

    async def create_intervention(self, intervention: Intervention) -> Intervention:
        return await self.intervention_repo.create_intervention(intervention)

    async def approve_intervention(self, intervention_id: str, approved_by: str = "CSM") -> Optional[Intervention]:
        intervention = await self.intervention_repo.get_by_id(intervention_id)
        if intervention:
            intervention.status = InterventionStatus.APPROVED
            intervention.approved_at = datetime.now(timezone.utc)
            intervention.approved_by = approved_by
            await self.db.commit()
            await self.db.refresh(intervention)
        return intervention

    async def reject_intervention(self, intervention_id: str, reason: Optional[str] = None, actor: str = "CSM") -> Optional[Intervention]:
        intervention = await self.intervention_repo.get_by_id(intervention_id)
        if intervention:
            intervention.status = InterventionStatus.REJECTED
            # Log human decision as SystemEvent for learning signal
            sys_log = SystemEventLog(
                id=f"log_{uuid.uuid4().hex[:10]}",
                timestamp=datetime.now(timezone.utc),
                customer_id=intervention.customer_id,
                event_type="HUMAN_DECISION",
                description=f"Intervention {intervention_id} rejected by {actor}",
                details={"intervention_id": intervention_id, "decision": "REJECT", "reason": reason, "actor": actor, "timestamp": datetime.now(timezone.utc).isoformat()},
            )
            self.db.add(sys_log)
            await self.db.commit()
            await self.db.refresh(intervention)
        return intervention

    async def modify_intervention(self, intervention_id: str, modified_action: Dict[str, Any], reason: str, actor: str = "CSM") -> Optional[Intervention]:
        """Capture MODIFY decision per S15 spec."""
        intervention = await self.intervention_repo.get_by_id(intervention_id)
        if intervention:
            # Store modification as plan update
            import json
            current_plan = intervention.plan or "[]"
            intervention.plan = json.dumps({"original_plan": current_plan, "modified_action": modified_action, "reason": reason})
            intervention.status = InterventionStatus.APPROVED  # modified counts as approved modified
            intervention.approved_at = datetime.now(timezone.utc)
            intervention.approved_by = actor
            sys_log = SystemEventLog(
                id=f"log_{uuid.uuid4().hex[:10]}",
                timestamp=datetime.now(timezone.utc),
                customer_id=intervention.customer_id,
                event_type="HUMAN_DECISION",
                description=f"Intervention {intervention_id} modified by {actor}",
                details={"intervention_id": intervention_id, "decision": "MODIFY", "modified_action": modified_action, "reason": reason, "actor": actor, "timestamp": datetime.now(timezone.utc).isoformat()},
            )
            self.db.add(sys_log)
            await self.db.commit()
            await self.db.refresh(intervention)
        return intervention

    async def get_human_feedback_summary(self, customer_id: str) -> List[Dict[str, Any]]:
        """Retrieve human feedback signals for learning."""
        res = await self.db.execute(select(SystemEventLog).where(SystemEventLog.customer_id == customer_id, SystemEventLog.event_type == "HUMAN_DECISION").order_by(SystemEventLog.timestamp.desc()))
        logs = list(res.scalars().all())
        return [{"decision": log.details.get("decision"), "reason": log.details.get("reason"), "actor": log.details.get("actor"), "timestamp": log.timestamp.isoformat()} for log in logs]
