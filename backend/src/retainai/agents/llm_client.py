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
        # Resolve api_key: prefer explicit, then settings.LLM_API_KEY, then GROQ_API_KEY alias, then env
        resolved_key = api_key or settings.LLM_API_KEY
        if (not resolved_key or resolved_key in ("mock_key_for_dev", "")) and getattr(settings, "GROQ_API_KEY", ""):
            resolved_key = settings.GROQ_API_KEY
        # Also check raw env for GROQ (in case .env has GROQ_API_KEY directly)
        if (not resolved_key or resolved_key in ("mock_key_for_dev", "")):
            import os
            env_groq = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_KEY")
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
        is_mock = self.api_key in ("your_llm_api_key_here", "mock_key_for_dev", "")
        if is_mock:
            logger.info(f"Using deterministic fallback response (mock API key) provider={self.provider} model={self.model}")
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
                # Groq OpenAI-compatible — fast inference for hackathon demo
                # Model examples: llama-3.3-70b-versatile, llama-3.1-8b-instant, meta-llama/llama-4-scout-17b-16e-instruct
                url = "https://api.groq.com/openai/v1/chat/completions"
                # Auto-map gemini model name to groq default if user forgot to change model
                effective_model = self.model
                if "gemini" in effective_model.lower() or "gpt" in effective_model.lower():
                    effective_model = "llama-3.3-70b-versatile"
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
                        logger.warning(f"Groq API returned HTTP {resp.status_code} body={resp.text[:300]}. Using fallback.")

        except Exception as e:
            logger.error(f"LLM call failed with exception: {e}. Executing deterministic fallback.")

        # 3. Fallback on any failure
        return response_schema.model_validate(fallback_data)
