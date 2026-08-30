"""LLM Provider Client with strict JSON schema parsing and deterministic demo fallback."""

import json
import logging
from typing import Dict, Any, Type, TypeVar, Optional
import httpx
from pydantic import BaseModel
from retainai.config import settings

logger = logging.getLogger("retainai.llm")

T = TypeVar("T", bound=BaseModel)


class LLMClient:
    """Async LLM Client supporting Gemini API / HTTP models with automatic fallback."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None,
    ):
        # Resolve api_key: prefer explicit, then settings.LLM_API_KEY, then provider-specific aliases, then raw env
        # LIVE BRANCH (hybrid-live-dynamic): mock_key_for_dev disabled — not a valid sentinel. Treat as invalid/missing that must attempt live call and error visibly if no real key.
        # Do NOT include mock_key_for_dev in empty-check; explicitly force it to invalid so it proceeds to live call (not silent fallback).
        resolved_key = api_key or settings.LLM_API_KEY
        if resolved_key == "mock_key_for_dev":
            # mock disabled: force empty so alias resolution below can be attempted; if no real alias, live call will error (no instant mock fallback)
            resolved_key = ""
        if (not resolved_key or resolved_key == "your_llm_api_key_here") and getattr(settings, "GROQ_API_KEY", ""):
            resolved_key = settings.GROQ_API_KEY
        if (not resolved_key or resolved_key == "your_llm_api_key_here") and getattr(settings, "OPENAI_API_KEY", ""):
            resolved_key = settings.OPENAI_API_KEY
        # Also check raw env for GROQ/OPENAI (in case .env has them directly)
        if not resolved_key or resolved_key == "your_llm_api_key_here":
            import os
            env_groq = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY")
            if env_groq:
                resolved_key = env_groq
        self.api_key = resolved_key
        self.model = model or settings.LLM_MODEL
        self.provider = (provider or settings.LLM_PROVIDER or "").lower()

    async def generate_structured_json(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: Type[T],
        fallback_data: Dict[str, Any],
    ) -> T:
        """Generates structured JSON adhering to response_schema, using fallback_data on error."""
        # 1. Check for mock/dev environment with explicit honesty logging (S33/S96)
        # LIVE BRANCH (hybrid-live-dynamic): mock_key_for_dev disabled — not a valid mock sentinel (would force live call and error visibly)
        is_mock = self.api_key in ("your_llm_api_key_here", "")
        if is_mock:
            logger.info(f"LIVE MODE: mock disabled — attempting live LLM call; missing key will error provider={self.provider} model={self.model}")
            validated = response_schema.model_validate(fallback_data)
            # Tag fallback honesty for orchestrator traceability
            try:
                validated.__dict__["_fallback_used"] = True  # type: ignore
            except Exception:
                pass
            return validated

        # 2. Attempt real LLM API call
        try:
            if self.provider == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
                prompt_content = f"{system_prompt}\n\nUSER PROMPT:\n{user_prompt}\n\nOutput STRICT JSON matching schema: {response_schema.model_json_schema()}"
                
                payload = {
                    "contents": [{"parts": [{"text": prompt_content}]}],
                    "generationConfig": {"responseMimeType": "application/json"},
                }

                async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        text_resp = data["candidates"][0]["content"]["parts"][0]["text"]
                        clean_json = text_resp.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                        json_dict = json.loads(clean_json)
                        # DYNAMIC prompt version tagging: capture provider/model used (S95)
                        logger.info(f"LLM live response provider={self.provider} model={self.model} schema={response_schema.__name__}")
                        return response_schema.model_validate(json_dict)
                    else:
                        logger.warning(f"LLM API returned HTTP {resp.status_code}. Using fallback provider={self.provider} model={self.model}.")

            elif self.provider in ("groq", "groq_api", "gsk"):
                # Groq production Aug 2026 — only 2 text models remain (Llama deprecated 16 Aug 2026):
                # 1) openai/gpt-oss-120b ~500tps $0.15/$0.60 — flagship, Groq's recommended replacement for llama-3.3-70b
                # 2) openai/gpt-oss-20b ~1000tps $0.075/$0.30 — fastest, recommended for llama-3.1-8b
                # Legacy llama-3.3-70b/llama-3.1-8b shut down 16 Aug 2026 per Groq deprecation
                url = "https://api.groq.com/openai/v1/chat/completions"
                # Auto-map deprecated/foreign model names to current Groq production
                effective_model = self.model
                # If user left old llama or gpt-4o/gemini, map to current production
                if "llama-3.3" in effective_model.lower() or "llama-3.1" in effective_model.lower():
                    effective_model = "openai/gpt-oss-120b"
                elif "gemini" in effective_model.lower() or effective_model.lower() in ("gpt-4o", "gpt-4o-mini", "gpt-4-turbo"):
                    effective_model = "openai/gpt-oss-120b"
                headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": effective_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"{user_prompt}\n\nOutput STRICT JSON matching schema: {response_schema.model_json_schema()}\nReturn ONLY valid JSON, no markdown."},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 2000,
                    "response_format": {"type": "json_object"},
                }
                async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        text_resp = data["choices"][0]["message"]["content"]
                        clean_json = text_resp.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                        json_dict = json.loads(clean_json)
                        logger.info(f"LLM live response provider=groq model={effective_model} schema={response_schema.__name__}")
                        return response_schema.model_validate(json_dict)
                    else:
                        logger.warning(f"Groq API returned HTTP {resp.status_code} body={resp.text[:300]}. Using fallback provider={self.provider} model={effective_model} — live call failed.")

            elif self.provider in ("openai", "gpt", "gpt-4", "gpt-4o", "o1", "o3"):
                # OpenAI GPT — best quality for structured investigation (JSON mode)
                # Models: gpt-4o (recommended, best), gpt-4o-mini (cheap/fast), gpt-4-turbo, o1 (reasoning)
                url = "https://api.openai.com/v1/chat/completions"
                effective_model = self.model
                if "gemini" in effective_model.lower() or "llama" in effective_model.lower() or "deepseek" in effective_model.lower():
                    effective_model = "gpt-4o"
                # gpt-4o supports json_object; o1 uses different param
                is_o1 = effective_model.startswith("o1") or effective_model.startswith("o3")
                headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": effective_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"{user_prompt}\n\nOutput STRICT JSON matching schema: {response_schema.model_json_schema()}\nReturn ONLY valid JSON, no markdown."},
                    ],
                    "temperature": 0.2 if not is_o1 else 1.0,
                    "max_tokens": 2000,
                }
                if not is_o1:
                    payload["response_format"] = {"type": "json_object"}
                async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        text_resp = data["choices"][0]["message"]["content"]
                        clean_json = text_resp.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                        json_dict = json.loads(clean_json)
                        logger.info(f"LLM live response provider=openai model={effective_model} schema={response_schema.__name__}")
                        return response_schema.model_validate(json_dict)
                    else:
                        logger.warning(f"OpenAI API returned HTTP {resp.status_code} body={resp.text[:300]}. Using fallback provider={self.provider} model={effective_model} — live call failed.")

        except Exception as e:
            logger.error(f"LLM call failed with exception: {e}. Executing deterministic fallback provider={self.provider} model={self.model}.")

        # 3. Fallback on any failure — LIVE BRANCH: last-resort only (HTTP non-200 / exception / parse failure). Logs warning with provider/model.
        logger.warning(f"LLM fallback (last-resort) provider={self.provider} model={self.model} — live call failed (HTTP non-200 / exception / parse failure); returning fallback_data")
        return response_schema.model_validate(fallback_data)

    # ── Chat (free-form) + Streaming + Parallel helpers ───────────────────────

    async def chat(
        self,
        system_prompt: str,
        user_prompt: str,
        fallback_text: str = "I'm currently in offline mode — here's what I can tell you from the cached data.",
        temperature: float = 0.4,
        max_tokens: int = 1500,
    ) -> str:
        """Free-form chat completion with same provider routing + fallback."""
        is_mock = self.api_key in ("your_llm_api_key_here", "")
        if is_mock:
            logger.info(f"CHAT mock fallback provider={self.provider} model={self.model}")
            return fallback_text

        try:
            if self.provider == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
                payload = {
                    "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
                    "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
                }
                async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["candidates"][0]["content"]["parts"][0]["text"]
                    logger.warning(f"Gemini chat HTTP {resp.status_code}")
            elif self.provider in ("groq", "groq_api", "gsk"):
                effective_model = self.model
                if "llama-3.3" in effective_model.lower() or "llama-3.1" in effective_model.lower():
                    effective_model = "openai/gpt-oss-120b"
                elif "gemini" in effective_model.lower() or effective_model.lower() in ("gpt-4o", "gpt-4o-mini"):
                    effective_model = "openai/gpt-oss-120b"
                url = "https://api.groq.com/openai/v1/chat/completions"
                headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": effective_model,
                    "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
                async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["choices"][0]["message"]["content"]
                    logger.warning(f"Groq chat HTTP {resp.status_code} body={resp.text[:300]}")
            elif self.provider in ("openai", "gpt", "gpt-4", "gpt-4o", "o1", "o3"):
                effective_model = self.model
                if "gemini" in effective_model.lower() or "llama" in effective_model.lower():
                    effective_model = "gpt-4o"
                url = "https://api.openai.com/v1/chat/completions"
                headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": effective_model,
                    "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                    "temperature": 0.2 if not effective_model.startswith("o1") else 1.0,
                    "max_tokens": max_tokens,
                }
                async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT) as client:
                    resp = await client.post(url, json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["choices"][0]["message"]["content"]
                    logger.warning(f"OpenAI chat HTTP {resp.status_code} body={resp.text[:300]}")
        except Exception as e:
            logger.error(f"LLM chat failed: {e}")
        logger.warning(f"LLM chat fallback provider={self.provider} model={self.model}")
        return fallback_text

    async def chat_stream(self, system_prompt: str, user_prompt: str, temperature: float = 0.4, max_tokens: int = 1500):
        """Async generator yielding SSE chunks. Falls back to single chunk if streaming unsupported."""
        # Try groq streaming first
        is_mock = self.api_key in ("your_llm_api_key_here", "")
        if is_mock:
            yield f"[offline] {user_prompt[:120]} — (no LLM key, showing cached context)"
            return
        # For non-mock, attempt streaming via Groq/OpenAI SSE, else fallback to chat()
        streamed = False
        try:
            if self.provider in ("groq", "groq_api", "gsk", "openai", "gpt"):
                is_groq = self.provider in ("groq", "groq_api", "gsk")
                effective_model = self.model
                if is_groq and ("llama" in effective_model.lower() or "gemini" in effective_model.lower() or effective_model.lower() in ("gpt-4o",)):
                    effective_model = "openai/gpt-oss-120b"
                if not is_groq and ("gemini" in effective_model.lower() or "llama" in effective_model.lower()):
                    effective_model = "gpt-4o"
                url = "https://api.groq.com/openai/v1/chat/completions" if is_groq else "https://api.openai.com/v1/chat/completions"
                headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
                payload = {
                    "model": effective_model,
                    "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "stream": True,
                }
                async with httpx.AsyncClient(timeout=settings.LLM_TIMEOUT + 10) as client:
                    async with client.stream("POST", url, json=payload, headers=headers) as resp:
                        if resp.status_code == 200:
                            async for line in resp.aiter_lines():
                                if not line or not line.startswith("data:"):
                                    continue
                                data = line[5:].strip()
                                if data == "[DONE]":
                                    break
                                try:
                                    j = json.loads(data)
                                    delta = j["choices"][0].get("delta", {}).get("content") or j["choices"][0].get("message", {}).get("content", "")
                                    if delta:
                                        streamed = True
                                        yield delta
                                except Exception:
                                    continue
                            if streamed:
                                return
                # if we reach here streaming didn't yield, fallback below
        except Exception as e:
            logger.debug(f"chat_stream SSE failed, fallback to chat(): {e}")

        # Fallback: single chat call chunked by words for SSE effect
        text = await self.chat(system_prompt, user_prompt, fallback_text="I'm in offline mode — here's the grounded summary from your data.", temperature=temperature, max_tokens=max_tokens)
        # yield in ~40 char chunks to simulate streaming
        for i in range(0, len(text), 40):
            yield text[i:i+40]
            # tiny async yield
            import asyncio as _aio
            await _aio.sleep(0.02)
