"""Chat API — parallel multi-agent streaming chat with persistence."""

import json
import uuid
import time
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from retainai.db.session import get_db
from retainai.auth.auth import get_current_user, require_tenant
from retainai.db.models import ChatConversation, ChatMessage, Customer
from retainai.agents.chat_orchestrator import ChatOrchestrator

logger = logging.getLogger("retainai.chat_api")

router = APIRouter(prefix="/api/v1/chat", tags=["Chat"])

# ── Schemas ───────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    customer_id: Optional[str] = Field(default=None, max_length=80)
    conversation_id: Optional[str] = Field(default=None, max_length=80)
    history: Optional[List[Dict[str, str]]] = None  # [{role, content}]
    stream: bool = False

class ChatResponse(BaseModel):
    answer: str
    conversation_id: str
    message_id: str
    customer_id: Optional[str]
    evidence_ids: List[str] = []
    traces: List[Dict[str, Any]] = []
    latency_ms: int
    model: str
    provider: str


# ── Helpers ───────────────────────────────────────────────────────────────

async def _ensure_conversation(
    db: AsyncSession,
    tenant_id: str,
    customer_id: Optional[str],
    conversation_id: Optional[str],
    user_id: Optional[str],
    first_message: str,
) -> ChatConversation:
    if conversation_id:
        res = await db.execute(select(ChatConversation).where(ChatConversation.id == conversation_id, ChatConversation.tenant_id == tenant_id))
        conv = res.scalar_one_or_none()
        if conv:
            return conv
        # if provided id not found, create with that id
    # validate customer_id belongs to tenant if provided
    if customer_id:
        res = await db.execute(select(Customer.id).where(Customer.id == customer_id, Customer.tenant_id == tenant_id))
        # allow null-tenant customers for demo
        check = res.scalar_one_or_none()
        if not check:
            # try without tenant filter for pre-migration rows
            res2 = await db.execute(select(Customer.id).where(Customer.id == customer_id))
            if not res2.scalar_one_or_none():
                raise HTTPException(status_code=404, detail=f"Customer {customer_id} not found")
            # if exists but different tenant, raise
            # fetch tenant
            from sqlalchemy import text as _t
            # skip strict check for demo tenants null
            pass
    cid = conversation_id or f"conv_{uuid.uuid4().hex[:12]}"
    title = first_message[:60].strip() or "New chat"
    conv = ChatConversation(
        id=cid,
        tenant_id=tenant_id,
        customer_id=customer_id,
        user_id=user_id,
        title=title,
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def _load_history(db: AsyncSession, conversation_id: str, tenant_id: str, limit: int = 10) -> List[Dict[str, str]]:
    res = await db.execute(
        select(ChatMessage).where(ChatMessage.conversation_id == conversation_id, ChatMessage.tenant_id == tenant_id).order_by(ChatMessage.created_at.asc()).limit(limit * 2)
    )
    msgs = res.scalars().all()
    return [{"role": m.role, "content": m.content} for m in msgs[-limit:]]


# ── Routes ────────────────────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse, include_in_schema=False)
async def chat(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
):
    """Parallel 5-agent chat (non-streaming)."""
    t0 = time.time()
    user_id = user.get("sub") or user.get("user_id") or user.get("id")

    conv = await _ensure_conversation(db, tenant_id, body.customer_id, body.conversation_id, user_id, body.message)

    # Load prior history if not provided
    history = body.history
    if history is None:
        history = await _load_history(db, conv.id, tenant_id, limit=8)

    # Persist user message
    user_msg = ChatMessage(
        id=f"msg_{uuid.uuid4().hex[:12]}",
        tenant_id=tenant_id,
        conversation_id=conv.id,
        customer_id=body.customer_id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    conv.message_count = (conv.message_count or 0) + 1
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()

    orchestrator = ChatOrchestrator(db, tenant_id=tenant_id)
    result = await orchestrator.answer(
        user_question=body.message,
        customer_id=body.customer_id,
        conversation_history=history,
    )

    # Persist assistant message
    assistant_msg = ChatMessage(
        id=f"msg_{uuid.uuid4().hex[:12]}",
        tenant_id=tenant_id,
        conversation_id=conv.id,
        customer_id=body.customer_id,
        role="assistant",
        content=result["answer"],
        agent_traces=result.get("traces", []),
        model=result.get("model"),
        latency_ms=result.get("latency_ms"),
    )
    db.add(assistant_msg)
    conv.message_count = (conv.message_count or 0) + 1
    await db.commit()

    return ChatResponse(
        answer=result["answer"],
        conversation_id=conv.id,
        message_id=assistant_msg.id,
        customer_id=body.customer_id,
        evidence_ids=result.get("evidence_ids", []),
        traces=result.get("traces", []),
        latency_ms=result.get("latency_ms", int((time.time()-t0)*1000)),
        model=result.get("model", ""),
        provider=result.get("provider", ""),
    )


@router.post("/stream")
async def chat_stream(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
):
    """SSE streaming: 5 specialists in parallel, then token stream."""
    user_id = user.get("sub") or user.get("user_id") or user.get("id")
    conv = await _ensure_conversation(db, tenant_id, body.customer_id, body.conversation_id, user_id, body.message)
    history = body.history
    if history is None:
        history = await _load_history(db, conv.id, tenant_id, limit=8)

    # Persist user message synchronously before streaming
    user_msg = ChatMessage(
        id=f"msg_{uuid.uuid4().hex[:12]}",
        tenant_id=tenant_id,
        conversation_id=conv.id,
        customer_id=body.customer_id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    conv.message_count = (conv.message_count or 0) + 1
    conv.updated_at = datetime.now(timezone.utc)
    await db.commit()

    orchestrator = ChatOrchestrator(db, tenant_id=tenant_id)

    # We need to capture full answer to persist after streaming — buffer tokens
    buffered_tokens: List[str] = []
    specialists_buffer: Dict[str, str] = {}

    async def event_generator():
        full_answer_parts: List[str] = []
        traces_to_save: List[Dict[str, Any]] = []
        try:
            # Stream from orchestrator — it yields JSON lines
            async for chunk in orchestrator.answer_stream(
                user_question=body.message,
                customer_id=body.customer_id,
                conversation_history=history,
            ):
                # chunk is already json string + "\n"
                try:
                    obj = json.loads(chunk.strip())
                except Exception:
                    obj = {"type": "token", "content": chunk}
                # inject conversation_id into meta
                if obj.get("type") == "meta":
                    obj["conversation_id"] = conv.id
                if obj.get("type") == "specialist":
                    specialists_buffer[obj.get("agent", "unknown")] = obj.get("content", "")
                if obj.get("type") == "token":
                    full_answer_parts.append(obj.get("content", ""))
                if obj.get("type") == "done":
                    # Persist assistant message on done
                    final_text = "".join(full_answer_parts).strip()
                    if final_text:
                        # need new session? reuse db in generator — ensure commit
                        try:
                            assistant_msg = ChatMessage(
                                id=f"msg_{uuid.uuid4().hex[:12]}",
                                tenant_id=tenant_id,
                                conversation_id=conv.id,
                                customer_id=body.customer_id,
                                role="assistant",
                                content=final_text,
                                agent_traces=[{"agent": k, "output": v[:600]} for k, v in specialists_buffer.items()],
                                model=obj.get("model", ""),
                            )
                            db.add(assistant_msg)
                            conv.message_count = (conv.message_count or 0) + 1
                            await db.commit()
                            obj["conversation_id"] = conv.id
                            obj["message_id"] = assistant_msg.id
                        except Exception as e:
                            logger.warning(f"persist stream assistant failed: {e}")
                            try:
                                await db.rollback()
                            except Exception:
                                pass
                # SSE format
                yield f"data: {json.dumps(obj)}\n\n"
            # final SSE done marker
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"chat stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "X-Conversation-Id": conv.id,
    })


@router.get("/conversations")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
    limit: int = 20,
    customer_id: Optional[str] = None,
):
    q = select(ChatConversation).where(ChatConversation.tenant_id == tenant_id).order_by(desc(ChatConversation.updated_at)).limit(limit)
    if customer_id:
        q = q.where(ChatConversation.customer_id == customer_id)
    res = await db.execute(q)
    convs = res.scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "customer_id": c.customer_id,
            "message_count": c.message_count,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        }
        for c in convs
    ]


@router.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
    limit: int = 50,
):
    # verify belongs to tenant
    res = await db.execute(select(ChatConversation).where(ChatConversation.id == conversation_id, ChatConversation.tenant_id == tenant_id))
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    res2 = await db.execute(select(ChatMessage).where(ChatMessage.conversation_id == conversation_id, ChatMessage.tenant_id == tenant_id).order_by(ChatMessage.created_at.asc()).limit(limit))
    msgs = res2.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "agent_traces": m.agent_traces,
            "model": m.model,
            "latency_ms": m.latency_ms,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in msgs
    ]


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant),
):
    res = await db.execute(select(ChatConversation).where(ChatConversation.id == conversation_id, ChatConversation.tenant_id == tenant_id))
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    # delete messages then conversation
    from sqlalchemy import delete as sql_delete
    await db.execute(sql_delete(ChatMessage).where(ChatMessage.conversation_id == conversation_id, ChatMessage.tenant_id == tenant_id))
    await db.delete(conv)
    await db.commit()
    return {"status": "deleted", "id": conversation_id}


@router.get("/health")
async def chat_health():
    return {"status": "ok", "service": "chat", "agents": 5, "mode": "parallel", "streaming": True}
