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


@pytest.mark.parametrize(
    "exc_class",
    [LLMTimeoutError, LLMAuthError, LLMQuotaError, LLMResponseError],
)
def test_subclasses_carry_message(exc_class):
    exc = exc_class("mensagem de teste")
    assert "mensagem de teste" in str(exc)
