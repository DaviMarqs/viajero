import pytest

from apps.ai.providers.base import (
    LLMAuthError,
    LLMProviderError,
    LLMQuotaError,
    LLMResponseError,
    LLMTimeoutError,
)


def test_all_subclasses_inherit_from_provider_error():
    for cls in (LLMTimeoutError, LLMAuthError, LLMQuotaError, LLMResponseError):
        assert issubclass(cls, LLMProviderError)


def test_provider_error_carries_message():
    exc = LLMTimeoutError("timeout em 20s")
    assert "timeout" in str(exc)
