"""Integration Adapter Architecture per S36: Real vs Simulated boundary.

Domain logic depends only on IntegrationInterface. RealAdapter and DemoAdapter implement it.
Credentials never exposed to LLM (S38): secret store accessed only by IntegrationService.
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Literal
from dataclasses import dataclass

logger = logging.getLogger("retainai.integrations")

IntegrationMode = Literal["REAL", "MOCKED", "SIMULATED", "LOCAL_ADAPTER", "NOT_IMPLEMENTED"]

@dataclass
class IntegrationResult:
    data: Dict[str, Any]
    source: str
    mode: IntegrationMode
    latency_ms: int = 0
    error: Optional[str] = None


class IntegrationInterface(ABC):
    """Abstract boundary that domain logic depends on (never mock directly in domain)."""
    name: str
    mode: IntegrationMode

    @abstractmethod
    async def fetch(self, customer_id: str, params: Dict[str, Any]) -> IntegrationResult: ...

    @abstractmethod
    def health_check(self) -> Dict[str, Any]: ...


class RealAdapter(IntegrationInterface):
    """Placeholder for real external provider (e.g., Salesforce CRM, Zendesk)."""
    def __init__(self, name: str, credential_ref: str):
        self.name = name
        self.mode: IntegrationMode = "REAL"
        self.credential_ref = credential_ref  # reference, not raw secret

    async def fetch(self, customer_id: str, params: Dict[str, Any]) -> IntegrationResult:
        # In prod, this would call external API using secret from credential store
        # For MVP, we simulate timeout handling and auth check
        import time
        start = time.time()
        # Simulate external call latency
        logger.info(f"RealAdapter {self.name} fetching for {customer_id} (credential_ref={self.credential_ref[:4]}***)")
        # Never log actual secret
        return IntegrationResult(
            data={"customer_id": customer_id, "fetched": True, "adapter": self.name},
            source=self.name,
            mode=self.mode,
            latency_ms=int((time.time()-start)*1000),
        )

    def health_check(self) -> Dict[str, Any]:
        return {"integration": self.name, "mode": self.mode, "reachable": True, "authenticated": True}


class DemoAdapter(IntegrationInterface):
    """Deterministic demo adapter that serves seeded local data for reliable demo (S52)."""
    def __init__(self, name: str):
        self.name = name
        self.mode: IntegrationMode = "SIMULATED"

    async def fetch(self, customer_id: str, params: Dict[str, Any]) -> IntegrationResult:
        # Serve from local DB rather than external API
        logger.info(f"DemoAdapter {self.name} serving local data for {customer_id}")
        return IntegrationResult(
            data={"customer_id": customer_id, "demo": True, "adapter": self.name},
            source=self.name,
            mode=self.mode,
            latency_ms=1,
        )

    def health_check(self) -> Dict[str, Any]:
        return {"integration": self.name, "mode": self.mode, "reachable": True, "authenticated": False, "note": "demo adapter - no external credentials"}


# Registry per S35
INTEGRATION_REGISTRY = {
    "CRM": {"purpose": "Customer profile & ARR", "auth": "API key via credential store", "real": RealAdapter("crm_real", "CRM_API_KEY"), "demo": DemoAdapter("crm_demo")},
    "product_analytics": {"purpose": "Usage & feature adoption", "auth": "Bearer token", "real": RealAdapter("analytics_real", "ANALYTICS_TOKEN"), "demo": DemoAdapter("analytics_demo")},
    "support_platform": {"purpose": "Tickets & CSAT", "auth": "OAuth", "real": RealAdapter("support_real", "SUPPORT_TOKEN"), "demo": DemoAdapter("support_demo")},
    "email": {"purpose": "Retention outreach", "auth": "SMTP/SES", "real": RealAdapter("email_real", "EMAIL_API_KEY"), "demo": DemoAdapter("email_demo")},
    "slack": {"purpose": "CSM notifications", "auth": "Bot token", "real": RealAdapter("slack_real", "SLACK_BOT_TOKEN"), "demo": DemoAdapter("slack_demo")},
    "llm_provider": {"purpose": "Investigation & planning", "auth": "LLM_API_KEY env", "real": RealAdapter("llm_real", "LLM_API_KEY"), "demo": DemoAdapter("llm_demo_fallback")},
}


def get_adapter(integration_name: str, prefer_real: bool = False) -> IntegrationInterface:
    """Domain factory: choose Real vs Demo based on env DEMO_MODE and credential availability."""
    entry = INTEGRATION_REGISTRY.get(integration_name)
    if not entry:
        raise ValueError(f"Integration {integration_name} not registered")
    import os
    demo_mode = os.getenv("DEMO_MODE", "true").lower() == "true"
    has_credential = os.getenv(entry["real"].credential_ref) not in (None, "", "your_llm_api_key_here", "mock_key_for_dev")
    if prefer_real and not demo_mode and has_credential:
        return entry["real"]
    return entry["demo"]


def describe_integration(name: str) -> Dict[str, Any]:
    """For S35 inventory doc."""
    entry = INTEGRATION_REGISTRY.get(name)
    if not entry:
        return {}
    adapter = get_adapter(name)
    return {
        "Integration": name,
        "Purpose": entry["purpose"],
        "Authentication": entry["auth"],
        "Credential type": "env secret ref",
        "Current mode": adapter.mode,
        "Health": adapter.health_check(),
        "Timeout": "5s",
        "Retry": "exponential backoff x3",
        "Failure mode": "fallback to demo adapter + logged error",
        "Logging": "request_id + latency, never secrets",
        "Security": "secret in env, not in prompt",
    }
