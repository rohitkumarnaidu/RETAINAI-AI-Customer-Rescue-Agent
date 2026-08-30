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
        self.api_key = api_key or settings.LLM_API_KEY
        self.model = model or settings.LLM_MODEL
        self.provider = provider or settings.LLM_PROVIDER

    async def generate_structured_json(
        self,
        system_prompt: str,
        user_prompt: str,
        response_schema: Type[T],
        fallback_data: Dict[str, Any],
    ) -> T:
        """Generates structured JSON adhering to response_schema, using fallback_data on error."""
        # 1. Check for mock/dev environment
        if self.api_key in ("your_llm_api_key_here", "mock_key_for_dev", ""):
            logger.info("Using deterministic fallback response (mock API key).")
            return response_schema.model_validate(fallback_data)

        # 2. Attempt real LLM API call
        try:
            if self.provider == "gemini":
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
                prompt_content = f"{system_prompt}\n\nUSER PROMPT:\n{user_prompt}\n\nOutput STRICT JSON matching schema: {response_schema.model_json_schema()}"
                
                payload = {
                    "contents": [{"parts": [{"text": prompt_content}]}],
                    "generationConfig": {"responseMimeType": "application/json"},
                }

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        text_resp = data["candidates"][0]["content"]["parts"][0]["text"]
                        clean_json = text_resp.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                        json_dict = json.loads(clean_json)
                        return response_schema.model_validate(json_dict)
                    else:
                        logger.warning(f"LLM API returned HTTP {resp.status_code}. Using fallback.")

        except Exception as e:
            logger.error(f"LLM call failed with exception: {e}. Executing deterministic fallback.")

        # 3. Fallback on any failure
        return response_schema.model_validate(fallback_data)
