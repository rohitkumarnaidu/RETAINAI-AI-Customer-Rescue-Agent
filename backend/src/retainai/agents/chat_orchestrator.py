"""Parallel Multi-Agent Chat Orchestrator — 5 specialists run concurrently + streaming aggregator."""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator, Dict, Any, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from retainai.agents.llm_client import LLMClient
from retainai.agents.tools import AgentTools
from retainai.services.customer_service import CustomerService

logger = logging.getLogger("retainai.chat")

# ── Specialist system prompts ─────────────────────────────────────────────

USAGE_PROMPT = """You are RETAINAI Usage Analyst (specialist).
Analyze ONLY usage telemetry. Be concise (3-5 bullets).
Cite DAU, license_utilization, feature_clicks, wau/mau if present.
If no usage data, say "No usage telemetry available."
Output plain text, no JSON."""

SUPPORT_PROMPT = """You are RETAINAI Support Analyst (specialist).
Analyze ONLY support tickets. Summarize severity, count, status, and key subjects.
Cite ticket IDs. If no tickets, say "No support tickets in window."
Output plain text."""

SENTIMENT_PROMPT = """You are RETAINAI Sentiment Analyst (specialist).
Analyze ONLY customer feedback / NPS / sentiment.
Summarize sentiment trend, scores, verbatims. Cite feedback IDs.
If no feedback, say "No feedback in window."
Output plain text."""

MEMORY_PROMPT = """You are RETAINAI Memory Analyst (specialist).
Analyze ONLY experience memories / validated patterns for this segment & risk.
Extract 1-2 relevant past strategies and their success rate.
If no memories, say "No validated memories for this segment."
Output plain text."""

RISK_PROMPT = """You are RETAINAI Risk Analyst (specialist).
Analyze health_score, risk_level, signals, health components.
Explain WHY risk level, primary factor, confidence.
Cite signals. Keep to 3-4 lines.
Output plain text."""

# Aggregator that synthesizes specialists into final chat answer
SYNTHESIZER_PROMPT = """You are RETAINAI Chat Synthesizer — the final responder.
You have 5 specialist analyses (Usage, Support, Sentiment, Memory, Risk) plus customer profile and conversation history.
Rules:
1. Answer the USER QUESTION directly, grounded ONLY in provided data. Never invent ticket/feedback IDs not in evidence.
2. Weave specialist insights into one coherent answer (use markdown, short sections, bullets).
3. If evidence is sparse, say so honestly and suggest what to gather.
4. End with 1-2 suggested next actions and, if evidence present, list Evidence IDs.
5. Keep answer under 280 words unless user asked for detail. Be crisp, ops-ready.
"""


class ChatOrchestrator:
    """Tenant-isolated orchestrator that fans out to 5 specialist LLMs in parallel."""

    def __init__(self, session: AsyncSession, tenant_id: Optional[str] = None):
        self.session = session
        self.tenant_id = tenant_id
        self.tools = AgentTools(session, tenant_id=tenant_id)
        self.customer_service = CustomerService(session, tenant_id=tenant_id)
        self._tenant_llm_client: Optional[LLMClient] = None

    async def _load_tenant_llm(self) -> Optional[LLMClient]:
        if not self.tenant_id:
            return None
        try:
            from retainai.db.models import OrgSettings
            from retainai.auth.auth import decrypt_api_key
            res = await self.session.execute(select(OrgSettings).where(OrgSettings.tenant_id == self.tenant_id))
            org = res.scalar_one_or_none()
            if not org:
                return None
            provider = org.llm_provider or None
            model = org.llm_model or None
            api_key = None
            if org.llm_api_key_encrypted:
                try:
                    api_key = decrypt_api_key(org.llm_api_key_encrypted)
                except Exception:
                    api_key = None
            if provider or model or api_key:
                return LLMClient(api_key=api_key, model=model, provider=provider)
        except Exception as e:
            logger.debug(f"chat tenant LLM load failed: {e}")
        return None

    async def _gather_context_parallel(self, customer_id: Optional[str]) -> Dict[str, Any]:
        """Fetch all context in parallel (tenant-scoped)."""
        if not customer_id:
            return {
                "profile": None,
                "evidence": {"usage_events": [], "support_tickets": [], "feedback_entries": [], "account_events": []},
                "signals": [],
                "memories": [],
                "risk": None,
                "interventions": [],
            }

        async def safe(coro, default):
            try:
                return await coro
            except Exception as e:
                logger.debug(f"context gather safe failed: {e}")
                return default

        # fire all 5 in parallel
        profile_coro = self.tools.get_customer_profile(customer_id)
        evidence_coro = self.tools.search_customer_evidence(customer_id, days=30)
        signals_coro = self.tools.calculate_customer_signals(customer_id)
        # memory needs segment -> fetch after profile? but we can parallelize with empty segment fallback and re-query if needed
        # Instead do profile first? But spec wants full parallel — so we pipeline: first get profile+evidence+signals+risk in parallel, then memories.
        risk_coro = self.customer_service.reassess_customer_risk(customer_id)

        profile, evidence, signals, risk = await asyncio.gather(
            safe(profile_coro, {"error": "no profile"}),
            safe(evidence_coro, {"usage_events": [], "support_tickets": [], "feedback_entries": [], "account_events": []}),
            safe(signals_coro, []),
            safe(risk_coro, None),
        )

        # Now memory (needs segment)
        segment = profile.get("segment", "Enterprise") if isinstance(profile, dict) else "Enterprise"
        # Determine risk pattern for memory query
        risk_pattern = ""
        if isinstance(risk, dict):
            risk_pattern = risk.get("primary_root_cause") or risk.get("risk_level") or ""
        elif isinstance(profile, dict) and "risk_level" in profile:
            risk_pattern = profile.get("risk_level", "")
        memories = await safe(self.tools.query_experience_memory(segment=segment, risk_pattern=risk_pattern or "churn"), [])

        # interventions
        try:
            from retainai.db.models import Intervention
            q = select(Intervention).where(Intervention.customer_id == customer_id)
            if self.tenant_id:
                q = q.where(Intervention.tenant_id == self.tenant_id)
            q = q.order_by(Intervention.created_at.desc()).limit(3)
            res = await self.session.execute(q)
            inters = res.scalars().all()
            interventions = [{"id": iv.id, "title": iv.title, "status": iv.status.value if hasattr(iv.status, "value") else str(iv.status), "action_type": iv.action_type} for iv in inters]
        except Exception:
            interventions = []

        return {
            "profile": profile,
            "evidence": evidence,
            "signals": signals,
            "memories": memories,
            "risk": risk,
            "interventions": interventions,
        }

    async def _run_specialists_parallel(
        self,
        context: Dict[str, Any],
        user_question: str,
        llm: LLMClient,
    ) -> Dict[str, str]:
        """Run 5 specialist LLM calls concurrently."""
        evidence = context.get("evidence", {})
        risk = context.get("risk") or {}
        profile = context.get("profile") or {}
        signals = context.get("signals") or []
        memories = context.get("memories") or []

        # Build specialist payloads (small, focused)
        usage_payload = json.dumps({"usage_events": evidence.get("usage_events", [])[-8:]}, default=str)
        support_payload = json.dumps({"support_tickets": evidence.get("support_tickets", [])}, default=str)
        sentiment_payload = json.dumps({"feedback_entries": evidence.get("feedback_entries", []), "account_events": evidence.get("account_events", [])[-5:]}, default=str)
        memory_payload = json.dumps({"memories": memories, "segment": profile.get("segment", "")}, default=str)
        risk_payload = json.dumps({"profile": profile, "risk": risk, "signals": signals}, default=str)

        q = user_question.strip()[:800]

        async def call_specialist(prompt: str, data: str, label: str) -> str:
            start = time.time()
            fallback = f"[{label} offline] Based on cached data: {data[:300]}"
            try:
                # Reduced tokens to stay under Groq 8k TPM (5 parallel * 250 ~1250)
                res = await llm.chat(system_prompt=prompt, user_prompt=f"USER QUESTION: {q}\n\nDATA:\n{data}", fallback_text=fallback, temperature=0.3, max_tokens=250)
                latency = int((time.time()-start)*1000)
                logger.info(f"specialist {label} ok latency={latency}ms")
                return res
            except Exception as e:
                logger.warning(f"specialist {label} failed: {e}")
                return fallback

        # Fan-out 5 in parallel
        results = await asyncio.gather(
            call_specialist(USAGE_PROMPT, usage_payload, "usage"),
            call_specialist(SUPPORT_PROMPT, support_payload, "support"),
            call_specialist(SENTIMENT_PROMPT, sentiment_payload, "sentiment"),
            call_specialist(MEMORY_PROMPT, memory_payload, "memory"),
            call_specialist(RISK_PROMPT, risk_payload, "risk"),
        )
        return {
            "usage": results[0],
            "support": results[1],
            "sentiment": results[2],
            "memory": results[3],
            "risk": results[4],
        }

    def _build_synthesis_prompt(self, context: Dict[str, Any], specialists: Dict[str, str], history: List[Dict[str, str]], user_question: str) -> str:
        profile = context.get("profile") or {}
        risk = context.get("risk") or {}
        evidence = context.get("evidence") or {}
        # Collect evidence IDs for grounding check
        all_ids: List[str] = []
        for k in ["usage_events", "support_tickets", "feedback_entries", "account_events"]:
            for item in evidence.get(k, []) or []:
                if item.get("id"):
                    all_ids.append(item["id"])
        hist_text = ""
        if history:
            hist_lines = []
            for m in history[-6:]:
                hist_lines.append(f"{m['role'].upper()}: {m['content'][:300]}")
            hist_text = "\n".join(hist_lines)

        payload = {
            "user_question": user_question,
            "customer_profile": profile,
            "risk": risk,
            "evidence_ids_available": all_ids[:20],
            "specialists": specialists,
            "conversation_history": hist_text,
            "interventions": context.get("interventions", [])[:3],
        }
        return json.dumps(payload, default=str)

    async def answer(
        self,
        user_question: str,
        customer_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Non-streaming parallel answer — returns final text + traces."""
        t0 = time.time()
        llm = await self._load_tenant_llm()
        if llm is None:
            llm = LLMClient()

        # 1. parallel context gather
        ctx_t0 = time.time()
        context = await self._gather_context_parallel(customer_id)
        ctx_latency = int((time.time()-ctx_t0)*1000)

        # 2. parallel specialists
        spec_t0 = time.time()
        specialists = await self._run_specialists_parallel(context, user_question, llm)
        spec_latency = int((time.time()-spec_t0)*1000)

        # 3. synthesizer — 600 tokens to stay under TPM, with polished fallback that still synthesizes
        synth_t0 = time.time()
        synthesis_user = self._build_synthesis_prompt(context, specialists, conversation_history or [], user_question)
        # Polished offline fallback synthesizes specialists into markdown even if LLM 429
        def _offline_synth():
            cid = context.get("profile", {}).get("name") or "Customer"
            risk = context.get("risk", {}) or {}
            lvl = risk.get("risk_level", "unknown") if isinstance(risk, dict) else "unknown"
            health = risk.get("health_score", "") if isinstance(risk, dict) else ""
            lines = [f"### {cid} — {lvl} (health {health})", ""]
            for k in ["risk","usage","support","sentiment","memory"]:
                v = specialists.get(k, "")
                if v:
                    lines.append(f"**{k.upper()}**: {v.strip()[:400]}")
                    lines.append("")
            ev = [item.get("id") for kk in ["usage_events","support_tickets","feedback_entries"] for item in context.get("evidence", {}).get(kk, [])][:8]
            if ev:
                lines.append(f"**Evidence IDs**: {', '.join(ev)}")
            lines.append(f"\n**Next steps**: Review evidence → address root cause → MEASURE outcome in 14d.")
            return "\n".join(lines)
        fallback_synth = _offline_synth()
        final_text = await llm.chat(system_prompt=SYNTHESIZER_PROMPT, user_prompt=synthesis_user, fallback_text=fallback_synth, temperature=0.4, max_tokens=600)
        synth_latency = int((time.time()-synth_t0)*1000)

        total_latency = int((time.time()-t0)*1000)

        # Build evidence IDs for UI
        evidence = context.get("evidence", {})
        all_evidence_ids: List[str] = []
        for k in ["usage_events", "support_tickets", "feedback_entries", "account_events"]:
            for item in evidence.get(k, []) or []:
                if item.get("id"):
                    all_evidence_ids.append(item["id"])

        traces = [
            {"agent": "context_gather", "latency_ms": ctx_latency, "status": "ok", "signals": len(context.get("signals", []))},
            {"agent": "usage_analyst", "output": specialists["usage"][:500], "latency_ms": spec_latency},
            {"agent": "support_analyst", "output": specialists["support"][:500]},
            {"agent": "sentiment_analyst", "output": specialists["sentiment"][:500]},
            {"agent": "memory_analyst", "output": specialists["memory"][:500]},
            {"agent": "risk_analyst", "output": specialists["risk"][:500]},
            {"agent": "synthesizer", "latency_ms": synth_latency, "model": llm.model, "provider": llm.provider},
        ]

        return {
            "answer": final_text,
            "customer_id": customer_id,
            "evidence_ids": all_evidence_ids[:12],
            "specialists": specialists,
            "context": {
                "profile": context.get("profile"),
                "risk": context.get("risk"),
                "signals_count": len(context.get("signals", [])),
                "memories_count": len(context.get("memories", [])),
            },
            "traces": traces,
            "latency_ms": total_latency,
            "model": llm.model,
            "provider": llm.provider,
        }

    async def answer_stream(
        self,
        user_question: str,
        customer_id: Optional[str] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming SSE generator — yields JSON lines for frontend EventSource.

        Protocol: each yield is `data: {json}\n\n` string. Event types: meta, specialist, token, done, error.
        """
        llm = await self._load_tenant_llm()
        if llm is None:
            llm = LLMClient()

        # meta
        yield json.dumps({"type": "meta", "customer_id": customer_id, "provider": llm.provider, "model": llm.model}) + "\n"

        # parallel context
        context = await self._gather_context_parallel(customer_id)
        yield json.dumps({"type": "context", "signals": len(context.get("signals", [])), "memories": len(context.get("memories", [])), "evidence_ids": [item.get("id") for k in ["usage_events","support_tickets","feedback_entries"] for item in context.get("evidence", {}).get(k, [])][:12] }) + "\n"

        # specialists parallel — stream each as it completes? Use gather but yield incrementally
        specialists = await self._run_specialists_parallel(context, user_question, llm)
        for name, out in specialists.items():
            yield json.dumps({"type": "specialist", "agent": name, "content": out}) + "\n"
            await asyncio.sleep(0.05)

        # synthesizer streaming tokens — 650 to fit TPM
        synthesis_user = self._build_synthesis_prompt(context, specialists, conversation_history or [], user_question)
        async for token in llm.chat_stream(system_prompt=SYNTHESIZER_PROMPT, user_prompt=synthesis_user, temperature=0.4, max_tokens=650):
            yield json.dumps({"type": "token", "content": token}) + "\n"

        # done
        yield json.dumps({"type": "done"}) + "\n"
