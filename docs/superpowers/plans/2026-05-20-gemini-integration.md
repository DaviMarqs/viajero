# Gemini Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plugar o Gemini (Google) no backend pra (1) substituir o `MockItineraryGenerator` em `POST /api/itineraries/{id}/generate/` por geração real de roteiros e (2) atuar como fallback complementar paralelo ao Firecrawl em `GET /api/destinations/search/`.

**Architecture:** Cliente Gemini isolado em `apps/ai/providers/gemini.py`. Geração de roteiro vira `GeminiItineraryGenerator` (herda `BaseItineraryGenerator` existente). Fallback de destino vira `GeminiDestinationEnricher` (`BaseDestinationEnricher` novo). Orquestração paralela em `DestinationDiscoveryService` novo (`apps/destinations/services.py`), usando `ThreadPoolExecutor`. Firecrawl fica intacto. Spec completo em `docs/superpowers/specs/2026-05-20-gemini-integration-design.md`.

**Tech Stack:** Python 3.12, Django 5.2, DRF, `google-generativeai` SDK, `concurrent.futures.ThreadPoolExecutor`, pytest-django.

---

## Pre-requisitos

- Trabalhar a partir do diretório `backend/`.
- `cd /home/davi-aldivino-marques/Documentos/www/viajero/backend` antes de rodar comandos.
- Python venv: `.venv/bin/python` e `.venv/bin/pip`.
- A chave do Gemini deve estar em `backend/.env` como `GEMINI_API_KEY=...`. Já existe valor de desenvolvimento.
- Testes rodam com: `.venv/bin/python -m pytest tests/ -v`.

---

## Task 1: Dependências, settings e .env.example

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/config/settings/base.py:107-114` (bloco FIRECRAWL/LLM)
- Modify: `backend/.env.example`

- [ ] **Step 1: Adicionar `google-generativeai` em `requirements.txt`**

Adicionar uma linha em `backend/requirements.txt`:

```
google-generativeai>=0.8.0,<0.9.0
```

- [ ] **Step 2: Instalar dependência**

```bash
cd /home/davi-aldivino-marques/Documentos/www/viajero/backend
.venv/bin/pip install "google-generativeai>=0.8.0,<0.9.0"
```

Expected: instalação sem erros. Verifica:

```bash
.venv/bin/python -c "import google.generativeai as genai; print(genai.__name__)"
```

Expected output: `google.generativeai`

- [ ] **Step 3: Adicionar settings no `backend/config/settings/base.py`**

Localiza o bloco do FIRECRAWL/LLM (em torno da linha 107). Substitui o trecho existente que começa com `FIRECRAWL_API_KEY = ...` e termina com `LLM_API_KEY = ...` por:

```python
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")
FIRECRAWL_API_URL = os.getenv("FIRECRAWL_API_URL", "https://api.firecrawl.dev/v1")
FIRECRAWL_SEARCH_LIMIT = int(os.getenv("FIRECRAWL_SEARCH_LIMIT", "2"))
FIRECRAWL_CONNECT_TIMEOUT = float(os.getenv("FIRECRAWL_CONNECT_TIMEOUT", "5"))
FIRECRAWL_SEARCH_TIMEOUT = float(os.getenv("FIRECRAWL_SEARCH_TIMEOUT", "15"))
FIRECRAWL_SCRAPE_TIMEOUT = float(os.getenv("FIRECRAWL_SCRAPE_TIMEOUT", "25"))
FIRECRAWL_DISCOVERY_FAILURE_TTL = int(os.getenv("FIRECRAWL_DISCOVERY_FAILURE_TTL", "60"))

DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "mock")
DEFAULT_LLM_MODEL = os.getenv("DEFAULT_LLM_MODEL", "mock-itinerary-v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_TIMEOUT = float(os.getenv("GEMINI_TIMEOUT", "20"))
GEMINI_ITINERARY_TIMEOUT = float(os.getenv("GEMINI_ITINERARY_TIMEOUT", "40"))
```

- [ ] **Step 4: Atualizar `.env.example`**

Substituir o bloco LLM/FIRECRAWL no `backend/.env.example` por:

```
FIRECRAWL_API_KEY=
FIRECRAWL_API_URL=https://api.firecrawl.dev/v1
FIRECRAWL_SEARCH_LIMIT=2
FIRECRAWL_CONNECT_TIMEOUT=5
FIRECRAWL_SEARCH_TIMEOUT=15
FIRECRAWL_SCRAPE_TIMEOUT=25
FIRECRAWL_DISCOVERY_FAILURE_TTL=60
DEFAULT_LLM_PROVIDER=mock
DEFAULT_LLM_MODEL=mock-itinerary-v1
LLM_API_KEY=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
GEMINI_TIMEOUT=20
GEMINI_ITINERARY_TIMEOUT=40
```

- [ ] **Step 5: Sanity check — Django carrega**

```bash
.venv/bin/python manage.py check
```

Expected: `System check identified no issues (0 silenced).`

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/config/settings/base.py backend/.env.example
git commit -m "$(cat <<'EOF'
chore: adicionar dependencia e settings do Gemini

google-generativeai SDK + 4 envs novas (GEMINI_API_KEY, GEMINI_MODEL,
GEMINI_TIMEOUT, GEMINI_ITINERARY_TIMEOUT). DEFAULT_LLM_PROVIDER continua
'mock' por padrao; setar 'gemini' ativa o gerador real.
EOF
)"
```

---

## Task 2: Provider base (`apps/ai/providers/base.py`)

**Files:**
- Create: `backend/apps/ai/providers/__init__.py`
- Create: `backend/apps/ai/providers/base.py`
- Test: `backend/tests/test_llm_providers_base.py`

- [ ] **Step 1: Criar `__init__.py` vazio**

```bash
mkdir -p /home/davi-aldivino-marques/Documentos/www/viajero/backend/apps/ai/providers
touch /home/davi-aldivino-marques/Documentos/www/viajero/backend/apps/ai/providers/__init__.py
```

- [ ] **Step 2: Escrever teste de exceções**

Criar `backend/tests/test_llm_providers_base.py`:

```python
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
```

- [ ] **Step 3: Rodar teste (deve falhar)**

```bash
cd /home/davi-aldivino-marques/Documentos/www/viajero/backend
.venv/bin/python -m pytest tests/test_llm_providers_base.py -v
```

Expected: `ModuleNotFoundError: No module named 'apps.ai.providers.base'`

- [ ] **Step 4: Implementar `base.py`**

Criar `backend/apps/ai/providers/base.py`:

```python
"""Exceções e contratos comuns para LLM providers."""
from __future__ import annotations

from typing import Any, Protocol


class LLMProviderError(Exception):
    """Erro genérico de qualquer provider de LLM."""


class LLMTimeoutError(LLMProviderError):
    """O provider não respondeu dentro do timeout configurado."""


class LLMAuthError(LLMProviderError):
    """Credencial inválida ou ausente."""


class LLMQuotaError(LLMProviderError):
    """Rate limit ou cota excedida."""


class LLMResponseError(LLMProviderError):
    """Resposta vazia, JSON inválido ou fora do schema esperado."""


class LLMProvider(Protocol):
    """Contrato de um provider de LLM (Gemini, OpenAI etc)."""

    def generate_json(
        self,
        prompt: str,
        schema: dict[str, Any],
        *,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        ...

    def generate_text(self, prompt: str, *, timeout: float | None = None) -> str:
        ...
```

- [ ] **Step 5: Rodar teste (deve passar)**

```bash
.venv/bin/python -m pytest tests/test_llm_providers_base.py -v
```

Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/ai/providers/__init__.py backend/apps/ai/providers/base.py backend/tests/test_llm_providers_base.py
git commit -m "feat(ai): provider base com excecoes tipadas e Protocol"
```

---

## Task 3: `GeminiProvider` (`apps/ai/providers/gemini.py`)

**Files:**
- Create: `backend/apps/ai/providers/gemini.py`
- Test: `backend/tests/test_gemini_provider.py`

- [ ] **Step 1: Escrever testes (todos os caminhos de erro + sucesso)**

Criar `backend/tests/test_gemini_provider.py`:

```python
import json
from unittest.mock import MagicMock, patch

import pytest
from google.api_core import exceptions as google_exceptions

from apps.ai.providers.base import (
    LLMAuthError,
    LLMQuotaError,
    LLMResponseError,
    LLMTimeoutError,
)
from apps.ai.providers.gemini import GeminiProvider


SCHEMA = {"type": "object", "properties": {"x": {"type": "string"}}}


def _build_response(text: str):
    response = MagicMock()
    response.text = text
    return response


def test_generate_json_returns_parsed_dict(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.return_value = _build_response(json.dumps({"x": "hello"}))
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        result = GeminiProvider().generate_json("prompt", SCHEMA)
    assert result == {"x": "hello"}


def test_generate_json_raises_auth_error_when_key_missing(settings):
    settings.GEMINI_API_KEY = ""
    with pytest.raises(LLMAuthError):
        GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_raises_timeout_on_deadline_exceeded(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.side_effect = google_exceptions.DeadlineExceeded("slow")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        with pytest.raises(LLMTimeoutError):
            GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_raises_quota_on_429(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.side_effect = google_exceptions.ResourceExhausted("quota")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        with pytest.raises(LLMQuotaError):
            GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_raises_auth_on_permission_denied(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.side_effect = google_exceptions.PermissionDenied("nope")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        with pytest.raises(LLMAuthError):
            GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_raises_response_error_on_invalid_json(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.return_value = _build_response("not json {")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        with pytest.raises(LLMResponseError):
            GeminiProvider().generate_json("prompt", SCHEMA)


def test_generate_json_strips_markdown_fence(settings):
    """Gemini as vezes envolve o JSON em ```json ... ``` — devemos limpar."""
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.return_value = _build_response(
        '```json\n{"x": "hello"}\n```'
    )
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        result = GeminiProvider().generate_json("prompt", SCHEMA)
    assert result == {"x": "hello"}


def test_generate_text_returns_string(settings):
    settings.GEMINI_API_KEY = "fake-key"
    fake_model = MagicMock()
    fake_model.generate_content.return_value = _build_response("Hello world")
    with patch("apps.ai.providers.gemini.genai.GenerativeModel", return_value=fake_model):
        assert GeminiProvider().generate_text("prompt") == "Hello world"
```

- [ ] **Step 2: Rodar testes (devem falhar com ModuleNotFoundError)**

```bash
.venv/bin/python -m pytest tests/test_gemini_provider.py -v
```

Expected: erro de import.

- [ ] **Step 3: Implementar `gemini.py`**

Criar `backend/apps/ai/providers/gemini.py`:

```python
"""Cliente do Gemini (Google) via google-generativeai SDK."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import google.generativeai as genai
from django.conf import settings
from google.api_core import exceptions as google_exceptions

from .base import (
    LLMAuthError,
    LLMProviderError,
    LLMQuotaError,
    LLMResponseError,
    LLMTimeoutError,
)


logger = logging.getLogger(__name__)

_MARKDOWN_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class GeminiProvider:
    """Cliente do Gemini. Sem regras de negocio — so envia prompt e parseia retorno."""

    def __init__(self, model_name: str | None = None) -> None:
        self._model_name = model_name or settings.GEMINI_MODEL

    def _ensure_configured(self) -> None:
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise LLMAuthError("GEMINI_API_KEY nao configurada")
        genai.configure(api_key=api_key)

    def _build_model(self, system_instruction: str | None = None) -> genai.GenerativeModel:
        return genai.GenerativeModel(self._model_name, system_instruction=system_instruction)

    def _call(self, prompt: str, *, response_mime_type: str | None, timeout: float) -> str:
        self._ensure_configured()
        model = self._build_model()
        generation_config = {}
        if response_mime_type:
            generation_config["response_mime_type"] = response_mime_type
        try:
            response = model.generate_content(
                prompt,
                generation_config=generation_config or None,
                request_options={"timeout": timeout},
            )
        except google_exceptions.DeadlineExceeded as exc:
            raise LLMTimeoutError(f"Gemini timeout: {exc}") from exc
        except google_exceptions.ResourceExhausted as exc:
            raise LLMQuotaError(f"Gemini quota: {exc}") from exc
        except google_exceptions.PermissionDenied as exc:
            raise LLMAuthError(f"Gemini permissao: {exc}") from exc
        except google_exceptions.Unauthenticated as exc:
            raise LLMAuthError(f"Gemini auth: {exc}") from exc
        except google_exceptions.GoogleAPIError as exc:
            raise LLMProviderError(f"Gemini erro: {exc}") from exc
        text = (response.text or "").strip()
        if not text:
            raise LLMResponseError("Gemini retornou resposta vazia")
        return text

    def generate_text(self, prompt: str, *, timeout: float | None = None) -> str:
        return self._call(
            prompt,
            response_mime_type=None,
            timeout=timeout if timeout is not None else settings.GEMINI_TIMEOUT,
        )

    def generate_json(
        self,
        prompt: str,
        schema: dict[str, Any],
        *,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        full_prompt = (
            f"{prompt}\n\n"
            "Responda APENAS com JSON valido aderente ao schema abaixo, "
            "sem cercas de markdown e sem texto adicional:\n"
            f"{json.dumps(schema, ensure_ascii=False)}"
        )
        text = self._call(
            full_prompt,
            response_mime_type="application/json",
            timeout=timeout if timeout is not None else settings.GEMINI_TIMEOUT,
        )
        cleaned = _MARKDOWN_FENCE_RE.sub("", text).strip()
        try:
            payload = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.warning("Gemini retornou JSON invalido: %s", cleaned[:200])
            raise LLMResponseError(f"JSON invalido: {exc}") from exc
        if not isinstance(payload, dict):
            raise LLMResponseError("JSON retornado nao e um objeto")
        return payload
```

- [ ] **Step 4: Rodar testes (devem passar)**

```bash
.venv/bin/python -m pytest tests/test_gemini_provider.py -v
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/ai/providers/gemini.py backend/tests/test_gemini_provider.py
git commit -m "feat(ai): GeminiProvider com tratamento de excecoes tipadas"
```

---

## Task 4: Enricher base (`apps/ai/enrichers/base.py`)

**Files:**
- Create: `backend/apps/ai/enrichers/__init__.py`
- Create: `backend/apps/ai/enrichers/base.py`
- Test: `backend/tests/test_enricher_base.py`

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p /home/davi-aldivino-marques/Documentos/www/viajero/backend/apps/ai/enrichers
touch /home/davi-aldivino-marques/Documentos/www/viajero/backend/apps/ai/enrichers/__init__.py
```

- [ ] **Step 2: Escrever teste**

Criar `backend/tests/test_enricher_base.py`:

```python
import pytest

from apps.ai.enrichers.base import BaseDestinationEnricher, EnrichmentResult


def test_enrichment_result_has_meaningful_data_true_when_summary_set():
    result = EnrichmentResult(summary="abc")
    assert result.has_meaningful_data() is True


def test_enrichment_result_has_meaningful_data_true_when_pois_present():
    result = EnrichmentResult(pois=[{"name": "x", "type": "attraction"}])
    assert result.has_meaningful_data() is True


def test_enrichment_result_has_meaningful_data_false_when_empty():
    result = EnrichmentResult()
    assert result.has_meaningful_data() is False


def test_base_enricher_enrich_is_abstract():
    enricher = BaseDestinationEnricher()
    with pytest.raises(NotImplementedError):
        enricher.enrich(query="X", country="Brasil", city="")
```

- [ ] **Step 3: Rodar (deve falhar com ModuleNotFoundError)**

```bash
.venv/bin/python -m pytest tests/test_enricher_base.py -v
```

- [ ] **Step 4: Implementar `base.py`**

Criar `backend/apps/ai/enrichers/base.py`:

```python
"""Contrato base para enrichers de destino (Gemini, OpenAI, etc)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class EnrichmentResult:
    """Resultado de um enricher de destino, sem tocar no DB."""

    name: str = ""
    country: str = ""
    city: str = ""
    summary: str = ""
    best_season: str = ""
    timezone: str = ""
    pois: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    failures: list[dict[str, str]] = field(default_factory=list)

    def has_meaningful_data(self) -> bool:
        return bool(self.summary) or bool(self.pois)


class BaseDestinationEnricher:
    """Subclasses devolvem EnrichmentResult sem persistir."""

    def enrich(self, *, query: str, country: str = "", city: str = "") -> EnrichmentResult:
        raise NotImplementedError
```

- [ ] **Step 5: Rodar (deve passar)**

```bash
.venv/bin/python -m pytest tests/test_enricher_base.py -v
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/ai/enrichers/__init__.py backend/apps/ai/enrichers/base.py backend/tests/test_enricher_base.py
git commit -m "feat(ai): BaseDestinationEnricher + EnrichmentResult dataclass"
```

---

## Task 5: `GeminiDestinationEnricher`

**Files:**
- Create: `backend/apps/ai/enrichers/destination_gemini.py`
- Test: `backend/tests/test_gemini_enricher.py`

- [ ] **Step 1: Escrever testes**

Criar `backend/tests/test_gemini_enricher.py`:

```python
from unittest.mock import MagicMock, patch

import pytest

from apps.ai.enrichers.destination_gemini import GeminiDestinationEnricher
from apps.ai.providers.base import LLMResponseError, LLMTimeoutError


SAMPLE_PAYLOAD = {
    "name": "Bonito",
    "country": "Brasil",
    "city": "Bonito",
    "summary": "Cidade do Mato Grosso do Sul famosa pelas aguas cristalinas.",
    "best_season": "Maio a setembro",
    "timezone": "America/Campo_Grande",
    "pois": [
        {"name": "Gruta do Lago Azul", "type": "attraction", "summary": "Caverna com lago azul.", "tags": ["natureza"]},
        {"name": "Rio Sucuri", "type": "activity", "summary": "Flutuacao em rio cristalino.", "tags": ["aventura"]},
    ],
}


def test_enrich_returns_populated_result(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = SAMPLE_PAYLOAD
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="Bonito", country="Brasil")
    assert result.summary.startswith("Cidade do Mato Grosso")
    assert len(result.pois) == 2
    assert result.metadata["model"] == settings.GEMINI_MODEL
    # Cada POI gerado pelo Gemini deve trazer marca de origem
    assert all(poi["source"] == "gemini" for poi in result.pois)
    # POIs nao devem conter image_url (nivel Moderado)
    assert all("image_url" not in poi for poi in result.pois)


def test_enrich_returns_empty_result_on_timeout(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = LLMTimeoutError("slow")
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="X")
    assert result.has_meaningful_data() is False
    assert len(result.failures) == 1
    assert result.failures[0]["error_type"] == "LLMTimeoutError"


def test_enrich_retries_once_on_response_error_then_succeeds(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = [
        LLMResponseError("bad json"),
        SAMPLE_PAYLOAD,
    ]
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="Bonito")
    assert fake_provider.generate_json.call_count == 2
    assert result.has_meaningful_data() is True


def test_enrich_returns_empty_after_two_response_errors(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = [
        LLMResponseError("bad"),
        LLMResponseError("worse"),
    ]
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="X")
    assert result.has_meaningful_data() is False
    assert fake_provider.generate_json.call_count == 2


def test_enrich_drops_pois_without_name_or_type(settings):
    settings.GEMINI_API_KEY = "k"
    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = {
        "summary": "ok",
        "pois": [
            {"name": "Valido", "type": "attraction"},
            {"type": "attraction"},  # sem name
            {"name": "Sem tipo"},  # sem type
            {"name": "Tipo invalido", "type": "alien"},  # tipo nao na enum
        ],
    }
    with patch(
        "apps.ai.enrichers.destination_gemini.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiDestinationEnricher().enrich(query="X")
    # So o "Valido" deve passar; "Tipo invalido" cai no fallback "activity"
    names = [p["name"] for p in result.pois]
    assert "Valido" in names
    assert "Tipo invalido" in names
    assert len(result.pois) == 2
```

- [ ] **Step 2: Rodar (devem falhar)**

```bash
.venv/bin/python -m pytest tests/test_gemini_enricher.py -v
```

- [ ] **Step 3: Implementar `destination_gemini.py`**

Criar `backend/apps/ai/enrichers/destination_gemini.py`:

```python
"""Enricher de destino via Gemini — fallback complementar ao Firecrawl."""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

from apps.ai.providers.base import LLMProviderError, LLMResponseError
from apps.ai.providers.gemini import GeminiProvider

from .base import BaseDestinationEnricher, EnrichmentResult


logger = logging.getLogger(__name__)


VALID_POI_TYPES = {"attraction", "restaurant", "activity", "lodging"}

ENRICHMENT_PROMPT = (
    "Voce e uma fonte de dados de viagem. Para o destino '{query}' "
    "(pais: {country}, cidade: {city}), devolva JSON estruturado conforme o schema. "
    "Foque em informacao factual e atemporal. "
    "Para 'summary' use 2 a 3 paragrafos curtos. "
    "Para 'pois' liste ate 10 pontos REAIS e conhecidos, sem inventar URLs. "
    "'type' deve ser exatamente um destes valores: attraction, restaurant, activity, lodging. "
    "Se nao tiver certeza de algum campo, deixe vazio (string vazia ou array vazio)."
)

ENRICHMENT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "name": {"type": "string"},
        "country": {"type": "string"},
        "city": {"type": "string"},
        "summary": {"type": "string"},
        "best_season": {"type": "string"},
        "timezone": {"type": "string"},
        "pois": {
            "type": "array",
            "maxItems": 10,
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "type": {
                        "type": "string",
                        "enum": list(VALID_POI_TYPES),
                    },
                    "summary": {"type": "string"},
                    "tags": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "type"],
            },
        },
    },
}


class GeminiDestinationEnricher(BaseDestinationEnricher):
    def __init__(self, provider: GeminiProvider | None = None) -> None:
        self._provider = provider or GeminiProvider()

    def enrich(self, *, query: str, country: str = "", city: str = "") -> EnrichmentResult:
        prompt = ENRICHMENT_PROMPT.format(
            query=query,
            country=country or "Brasil",
            city=city or "(nao informado)",
        )
        payload = self._call_with_retry(prompt)
        if payload is None:
            return EnrichmentResult(failures=self._failures_so_far)
        return self._build_result(payload)

    def _call_with_retry(self, prompt: str) -> dict[str, Any] | None:
        self._failures_so_far: list[dict[str, str]] = []
        for attempt in (1, 2):
            try:
                return self._provider.generate_json(
                    prompt,
                    ENRICHMENT_SCHEMA,
                    timeout=settings.GEMINI_TIMEOUT,
                )
            except LLMResponseError as exc:
                logger.warning(
                    "Gemini enrich tentativa %d falhou com LLMResponseError: %s",
                    attempt, exc,
                )
                self._failures_so_far.append(
                    {"attempt": str(attempt), "error_type": "LLMResponseError", "error": str(exc)}
                )
                if attempt == 2:
                    return None
                continue
            except LLMProviderError as exc:
                logger.warning(
                    "Gemini enrich falhou com %s: %s", type(exc).__name__, exc,
                )
                self._failures_so_far.append(
                    {"attempt": str(attempt), "error_type": type(exc).__name__, "error": str(exc)}
                )
                return None
        return None

    def _build_result(self, payload: dict[str, Any]) -> EnrichmentResult:
        pois = self._sanitize_pois(payload.get("pois") or [])
        return EnrichmentResult(
            name=str(payload.get("name") or "")[:150],
            country=str(payload.get("country") or "")[:100],
            city=str(payload.get("city") or "")[:100],
            summary=str(payload.get("summary") or "")[:4000],
            best_season=str(payload.get("best_season") or "")[:120],
            timezone=str(payload.get("timezone") or "")[:64],
            pois=pois,
            metadata={"model": settings.GEMINI_MODEL, "source": "gemini"},
            failures=getattr(self, "_failures_so_far", []),
        )

    @staticmethod
    def _sanitize_pois(raw_pois: list[Any]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for raw in raw_pois:
            if not isinstance(raw, dict):
                continue
            name = (raw.get("name") or "").strip()
            if not name:
                continue
            raw_type = (raw.get("type") or "").strip().lower()
            if not raw_type:
                continue
            poi_type = raw_type if raw_type in VALID_POI_TYPES else "activity"
            tags_raw = raw.get("tags") or []
            tags = [str(t).strip() for t in tags_raw if isinstance(t, str) and str(t).strip()]
            out.append(
                {
                    "name": name[:160],
                    "type": poi_type,
                    "summary": str(raw.get("summary") or "")[:4000],
                    "tags": tags,
                    "source": "gemini",
                }
            )
        return out
```

- [ ] **Step 4: Rodar testes (devem passar)**

```bash
.venv/bin/python -m pytest tests/test_gemini_enricher.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/ai/enrichers/destination_gemini.py backend/tests/test_gemini_enricher.py
git commit -m "feat(ai): GeminiDestinationEnricher com retry e sanitizacao de POIs"
```

---

## Task 6: `GeminiItineraryGenerator`

**Files:**
- Create: `backend/apps/ai/generators/__init__.py`
- Create: `backend/apps/ai/generators/itinerary.py`
- Test: `backend/tests/test_gemini_itinerary_generator.py`

- [ ] **Step 1: Criar diretório**

```bash
mkdir -p /home/davi-aldivino-marques/Documentos/www/viajero/backend/apps/ai/generators
touch /home/davi-aldivino-marques/Documentos/www/viajero/backend/apps/ai/generators/__init__.py
```

- [ ] **Step 2: Escrever testes**

Criar `backend/tests/test_gemini_itinerary_generator.py`:

```python
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from apps.ai.generators.itinerary import GeminiItineraryGenerator
from apps.ai.providers.base import LLMResponseError, LLMTimeoutError
from apps.destinations.models import Destination, PointOfInterest


pytestmark = pytest.mark.django_db


def _make_itinerary():
    destination = Destination.objects.create(
        slug="curitiba",
        name="Curitiba",
        country="Brasil",
        city="Curitiba",
        summary="Capital paranaense.",
    )
    from apps.itineraries.models import Itinerary
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(username="u", password="x", email="u@u.com")
    itinerary = Itinerary.objects.create(
        user=user,
        destination=destination,
        title="Curitiba 4 dias",
        duration_days=4,
        budget_total=Decimal("2000"),
        currency_code="BRL",
    )
    return itinerary, destination


def _gemini_itinerary_payload(poi_id: int):
    return {
        "title": "Curitiba Cultural 4 Dias",
        "summary": "Imersao cultural pela capital paranaense.",
        "estimated_cost": "1850.00",
        "currency_code": "BRL",
        "days": [
            {
                "title": "Dia 1: Boas-vindas",
                "summary": "Tour pelo centro.",
                "events": [
                    {
                        "poi_id": poi_id,
                        "title": "Jardim Botanico",
                        "description": "Caminhada matinal.",
                        "estimated_cost": "0",
                        "order_index": 0,
                    },
                    {
                        "poi_id": None,
                        "title": "Almoco em barreado",
                        "description": "Prato tipico.",
                        "estimated_cost": "80",
                        "order_index": 1,
                    },
                ],
            }
        ],
    }


def test_generate_returns_normalized_dict_with_valid_poi_id():
    itinerary, destination = _make_itinerary()
    poi = PointOfInterest.objects.create(
        destination=destination,
        slug="jardim-botanico",
        name="Jardim Botanico",
        poi_type="attraction",
    )
    payload = _gemini_itinerary_payload(poi.id)

    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = payload

    with patch(
        "apps.ai.generators.itinerary.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiItineraryGenerator().generate(
            itinerary=itinerary,
            profile=None,
            preferences=None,
            pois=[poi],
            prompt_template=None,
        )

    assert result["title"] == "Curitiba Cultural 4 Dias"
    assert len(result["days"]) == 1
    events = result["days"][0]["events"]
    assert events[0]["poi_id"] == poi.id
    assert events[1]["poi_id"] is None


def test_generate_nullifies_invalid_poi_id():
    itinerary, destination = _make_itinerary()
    poi = PointOfInterest.objects.create(
        destination=destination,
        slug="jardim-botanico",
        name="Jardim Botanico",
        poi_type="attraction",
    )
    payload = _gemini_itinerary_payload(poi_id=99999)  # nao existe

    fake_provider = MagicMock()
    fake_provider.generate_json.return_value = payload

    with patch(
        "apps.ai.generators.itinerary.GeminiProvider",
        return_value=fake_provider,
    ):
        result = GeminiItineraryGenerator().generate(
            itinerary=itinerary,
            profile=None,
            preferences=None,
            pois=[poi],
            prompt_template=None,
        )

    assert result["days"][0]["events"][0]["poi_id"] is None


def test_generate_raises_after_retry_on_invalid_json():
    itinerary, _ = _make_itinerary()
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = [LLMResponseError("a"), LLMResponseError("b")]

    with patch(
        "apps.ai.generators.itinerary.GeminiProvider",
        return_value=fake_provider,
    ):
        with pytest.raises(LLMResponseError):
            GeminiItineraryGenerator().generate(
                itinerary=itinerary,
                profile=None,
                preferences=None,
                pois=[],
                prompt_template=None,
            )

    assert fake_provider.generate_json.call_count == 2


def test_generate_raises_on_timeout():
    itinerary, _ = _make_itinerary()
    fake_provider = MagicMock()
    fake_provider.generate_json.side_effect = LLMTimeoutError("slow")

    with patch(
        "apps.ai.generators.itinerary.GeminiProvider",
        return_value=fake_provider,
    ):
        with pytest.raises(LLMTimeoutError):
            GeminiItineraryGenerator().generate(
                itinerary=itinerary,
                profile=None,
                preferences=None,
                pois=[],
                prompt_template=None,
            )
```

- [ ] **Step 3: Rodar (devem falhar)**

```bash
.venv/bin/python -m pytest tests/test_gemini_itinerary_generator.py -v
```

- [ ] **Step 4: Implementar `itinerary.py`**

Criar `backend/apps/ai/generators/itinerary.py`:

```python
"""Gerador de roteiro via Gemini."""
from __future__ import annotations

import json
import logging
from decimal import Decimal
from typing import Any

from django.conf import settings

from apps.ai.providers.base import LLMProviderError, LLMResponseError
from apps.ai.providers.gemini import GeminiProvider
from apps.ai.services import BaseItineraryGenerator
from apps.destinations.models import PointOfInterest
from apps.itineraries.models import Itinerary
from apps.profiles.models import TravelerDNAProfile, UserTripPreference


logger = logging.getLogger(__name__)


ITINERARY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "estimated_cost": {"type": "string"},
        "currency_code": {"type": "string"},
        "days": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "summary": {"type": "string"},
                    "events": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "poi_id": {"type": ["integer", "null"]},
                                "title": {"type": "string"},
                                "description": {"type": "string"},
                                "start_time": {"type": "string"},
                                "end_time": {"type": "string"},
                                "estimated_cost": {"type": "string"},
                                "order_index": {"type": "integer"},
                            },
                            "required": ["title", "description", "order_index"],
                        },
                    },
                },
                "required": ["title", "events"],
            },
        },
    },
    "required": ["title", "days"],
}


class GeminiItineraryGenerator(BaseItineraryGenerator):
    def __init__(self, provider: GeminiProvider | None = None) -> None:
        self._provider = provider or GeminiProvider()

    def generate(
        self,
        *,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
        prompt_template,
    ) -> dict[str, Any]:
        context = self._build_context(itinerary, profile, preferences, pois)
        prompt = self._build_prompt(context, prompt_template)

        for attempt in (1, 2):
            try:
                payload = self._provider.generate_json(
                    prompt,
                    ITINERARY_SCHEMA,
                    timeout=settings.GEMINI_ITINERARY_TIMEOUT,
                )
            except LLMResponseError as exc:
                logger.warning("Gemini itinerary attempt %d response error: %s", attempt, exc)
                if attempt == 2:
                    raise
                prompt = self._reinforce_prompt(prompt)
                continue
            except LLMProviderError:
                raise

            return self._normalize_payload(payload, itinerary, pois)

        raise LLMResponseError("Gemini nao retornou roteiro valido apos retries")

    def _build_context(
        self,
        itinerary: Itinerary,
        profile: TravelerDNAProfile | None,
        preferences: UserTripPreference | None,
        pois: list[PointOfInterest],
    ) -> dict[str, Any]:
        ranked = sorted(pois, key=lambda p: (-(p.rating or 0), p.name))[:30]
        return {
            "destination": {
                "id": itinerary.destination_id,
                "name": itinerary.destination.name,
                "country": itinerary.destination.country,
                "city": itinerary.destination.city,
                "summary": itinerary.destination.summary[:500],
            },
            "duration_days": itinerary.duration_days,
            "currency_code": itinerary.currency_code,
            "budget_total": str(itinerary.budget_total),
            "profile": {
                "travel_style": getattr(profile, "travel_style", "flexivel"),
                "pace": getattr(profile, "pace", "balanced"),
            } if profile else None,
            "preferences": {
                "currency_code": getattr(preferences, "currency_code", itinerary.currency_code),
            } if preferences else None,
            "pois": [
                {
                    "id": p.id,
                    "name": p.name,
                    "type": p.poi_type,
                    "rating": str(p.rating),
                }
                for p in ranked
            ],
        }

    def _build_prompt(self, context: dict[str, Any], prompt_template) -> str:
        intro = (
            "Voce e um planejador de viagens. "
            f"Crie um roteiro de {context['duration_days']} dias para "
            f"{context['destination']['name']} ({context['destination']['country']}). "
            f"Orcamento total: {context['budget_total']} {context['currency_code']}. "
            "Prefira eventos que referenciem POIs existentes via 'poi_id'. "
            "Voce pode incluir eventos extras (refeicoes, transporte) com poi_id=null. "
            "Cada dia deve ter entre 2 e 5 eventos. "
            "estimated_cost de cada evento e do roteiro inteiro como string decimal."
        )
        if prompt_template and getattr(prompt_template, "template", ""):
            intro = f"{intro}\n\nTemplate adicional:\n{prompt_template.template}"
        return f"{intro}\n\nContexto:\n{json.dumps(context, ensure_ascii=False)}"

    def _reinforce_prompt(self, prompt: str) -> str:
        return (
            f"{prompt}\n\n"
            "IMPORTANTE: Sua resposta anterior nao era JSON valido. "
            "Responda APENAS com JSON, sem texto antes ou depois."
        )

    def _normalize_payload(
        self,
        payload: dict[str, Any],
        itinerary: Itinerary,
        pois: list[PointOfInterest],
    ) -> dict[str, Any]:
        valid_poi_ids = set(
            PointOfInterest.objects.filter(
                destination=itinerary.destination,
                id__in=self._collect_poi_ids(payload),
            ).values_list("id", flat=True)
        )

        days_out = []
        for day in payload.get("days") or []:
            events_out = []
            for event in day.get("events") or []:
                poi_id = event.get("poi_id")
                if poi_id is not None and poi_id not in valid_poi_ids:
                    logger.warning(
                        "Gemini referenciou poi_id=%s invalido para destino=%s; descartando FK",
                        poi_id, itinerary.destination_id,
                    )
                    poi_id = None
                events_out.append(
                    {
                        "poi_id": poi_id,
                        "title": str(event.get("title") or "")[:160],
                        "description": str(event.get("description") or "")[:4000],
                        "estimated_cost": str(event.get("estimated_cost") or "0"),
                        "order_index": int(event.get("order_index") or 0),
                    }
                )
            days_out.append(
                {
                    "title": str(day.get("title") or "")[:120],
                    "summary": str(day.get("summary") or "")[:4000],
                    "events": events_out,
                }
            )

        return {
            "title": str(payload.get("title") or itinerary.title)[:160],
            "summary": str(payload.get("summary") or ""),
            "estimated_cost": str(payload.get("estimated_cost") or "0"),
            "currency_code": str(payload.get("currency_code") or itinerary.currency_code),
            "days": days_out,
            "metadata": {
                "generator": "gemini",
                "model": settings.GEMINI_MODEL,
                "poi_count": len(pois),
            },
        }

    @staticmethod
    def _collect_poi_ids(payload: dict[str, Any]) -> list[int]:
        ids: list[int] = []
        for day in payload.get("days") or []:
            for event in day.get("events") or []:
                poi_id = event.get("poi_id")
                if isinstance(poi_id, int):
                    ids.append(poi_id)
        return ids
```

- [ ] **Step 5: Rodar (devem passar)**

```bash
.venv/bin/python -m pytest tests/test_gemini_itinerary_generator.py -v
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/apps/ai/generators/__init__.py backend/apps/ai/generators/itinerary.py backend/tests/test_gemini_itinerary_generator.py
git commit -m "feat(ai): GeminiItineraryGenerator com validacao de poi_id e retry"
```

---

## Task 7: Atualizar `get_generator()` em `apps/ai/services.py`

**Files:**
- Modify: `backend/apps/ai/services.py:65-68`
- Test: `backend/tests/test_get_generator.py`

- [ ] **Step 1: Escrever teste**

Criar `backend/tests/test_get_generator.py`:

```python
from apps.ai.generators.itinerary import GeminiItineraryGenerator
from apps.ai.services import MockItineraryGenerator, get_generator


def test_get_generator_returns_mock_by_default(settings):
    settings.DEFAULT_LLM_PROVIDER = "mock"
    assert isinstance(get_generator(), MockItineraryGenerator)


def test_get_generator_returns_gemini_when_configured(settings):
    settings.DEFAULT_LLM_PROVIDER = "gemini"
    settings.GEMINI_API_KEY = "fake"
    assert isinstance(get_generator(), GeminiItineraryGenerator)


def test_get_generator_falls_back_to_mock_when_gemini_key_missing(settings):
    settings.DEFAULT_LLM_PROVIDER = "gemini"
    settings.GEMINI_API_KEY = ""
    assert isinstance(get_generator(), MockItineraryGenerator)
```

- [ ] **Step 2: Rodar (deve falhar — gemini sempre retorna mock atualmente)**

```bash
.venv/bin/python -m pytest tests/test_get_generator.py -v
```

Expected: 1 fail (`test_get_generator_returns_gemini_when_configured`).

- [ ] **Step 3: Atualizar `get_generator`**

Em `backend/apps/ai/services.py`, substituir a função `get_generator()` por:

```python
def get_generator() -> BaseItineraryGenerator:
    provider = getattr(settings, "DEFAULT_LLM_PROVIDER", "mock")
    if provider == "gemini" and settings.GEMINI_API_KEY:
        from apps.ai.generators.itinerary import GeminiItineraryGenerator
        return GeminiItineraryGenerator()
    return MockItineraryGenerator()
```

(o import dentro da função evita ciclo com `apps.ai.generators.itinerary` que importa de `apps.ai.services`).

- [ ] **Step 4: Rodar (devem passar)**

```bash
.venv/bin/python -m pytest tests/test_get_generator.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/ai/services.py backend/tests/test_get_generator.py
git commit -m "feat(ai): get_generator ativa Gemini quando DEFAULT_LLM_PROVIDER=gemini"
```

---

## Task 8: `DestinationDiscoveryService` (orquestração paralela)

**Files:**
- Create: `backend/apps/destinations/services.py`
- Test: `backend/tests/test_destination_discovery.py`

- [ ] **Step 1: Escrever testes**

Criar `backend/tests/test_destination_discovery.py`:

```python
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from apps.ai.enrichers.base import EnrichmentResult
from apps.ai.providers.base import LLMTimeoutError
from apps.destinations.models import Destination, PointOfInterest
from apps.destinations.services import DestinationDiscoveryService
from apps.integrations.services import (
    AggregatedExtraction,
    FirecrawlError,
    FirecrawlIngestionService,
)


pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


def _firecrawl_aggregated(summary: str, pois: list[dict]) -> AggregatedExtraction:
    return AggregatedExtraction(
        source_urls=["https://example.com/x"],
        extracted_meta={"summary": summary},
        pois=pois,
    )


def _gemini_result(summary: str, pois: list[dict]) -> EnrichmentResult:
    return EnrichmentResult(summary=summary, pois=pois, metadata={"source": "gemini"})


def test_discover_merges_firecrawl_and_gemini_data(settings):
    settings.GEMINI_API_KEY = "fake"
    settings.FIRECRAWL_API_KEY = "fake"

    fc_pois = [{"name": "Praia Central", "type": "attraction", "tags": ["natureza"]}]
    g_pois = [{"name": "Mercado Municipal", "type": "restaurant", "source": "gemini"}]

    with patch.object(
        FirecrawlIngestionService,
        "_search_urls",
        return_value=["https://example.com/x"],
    ), patch.object(
        FirecrawlIngestionService,
        "_aggregate_payloads",
        return_value=_firecrawl_aggregated("Resumo do Firecrawl", fc_pois),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        enricher_cls.return_value.enrich.return_value = _gemini_result(
            "Resumo do Gemini", g_pois,
        )
        destination = DestinationDiscoveryService().discover(
            query="Florianopolis", country="Brasil", city="", actor=None,
        )

    assert destination is not None
    assert destination.summary == "Resumo do Firecrawl"  # Firecrawl > Gemini
    poi_names = set(destination.pois.values_list("name", flat=True))
    assert {"Praia Central", "Mercado Municipal"} <= poi_names
    sources = destination.metadata.get("sources") or {}
    assert sources == {"firecrawl": True, "gemini": True}


def test_discover_dedup_pois_by_slug_firecrawl_wins(settings):
    settings.GEMINI_API_KEY = "fake"
    settings.FIRECRAWL_API_KEY = "fake"

    fc_pois = [{"name": "Praia Central", "type": "attraction"}]
    g_pois = [{"name": "Praia Central", "type": "restaurant", "source": "gemini"}]  # mesmo slug

    with patch.object(
        FirecrawlIngestionService, "_search_urls", return_value=["https://x"],
    ), patch.object(
        FirecrawlIngestionService,
        "_aggregate_payloads",
        return_value=_firecrawl_aggregated("Resumo", fc_pois),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        enricher_cls.return_value.enrich.return_value = _gemini_result("ignorar", g_pois)
        destination = DestinationDiscoveryService().discover(
            query="X", country="", city="", actor=None,
        )

    poi = destination.pois.get(slug="praia-central")
    assert poi.poi_type == "attraction"  # Firecrawl venceu
    assert poi.metadata.get("source") != "gemini"


def test_discover_uses_gemini_when_firecrawl_fails(settings):
    settings.GEMINI_API_KEY = "fake"
    settings.FIRECRAWL_API_KEY = "fake"

    g_pois = [{"name": "Cachoeira", "type": "attraction", "source": "gemini"}]

    with patch.object(
        FirecrawlIngestionService,
        "_search_urls",
        side_effect=FirecrawlError("search down"),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        enricher_cls.return_value.enrich.return_value = _gemini_result(
            "So o Gemini respondeu", g_pois,
        )
        destination = DestinationDiscoveryService().discover(
            query="LugarMisterioso", country="", city="", actor=None,
        )

    assert destination is not None
    assert destination.summary == "So o Gemini respondeu"
    sources = destination.metadata.get("sources") or {}
    assert sources == {"firecrawl": False, "gemini": True}


def test_discover_returns_none_when_both_fail(settings):
    settings.GEMINI_API_KEY = "fake"
    settings.FIRECRAWL_API_KEY = "fake"
    settings.FIRECRAWL_DISCOVERY_FAILURE_TTL = 60

    with patch.object(
        FirecrawlIngestionService,
        "_search_urls",
        side_effect=FirecrawlError("down"),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        enricher_cls.return_value.enrich.return_value = EnrichmentResult()

        service = DestinationDiscoveryService()
        first = service.discover(query="Fantasma", country="", city="", actor=None)
        # 2a chamada nao deve disparar nem Firecrawl nem Gemini (cache)
        enricher_cls.return_value.enrich.reset_mock()
        second = service.discover(query="Fantasma", country="", city="", actor=None)

    assert first is None
    assert second is None
    assert not Destination.objects.filter(slug="fantasma").exists()
    enricher_cls.return_value.enrich.assert_not_called()


def test_discover_skips_gemini_when_key_missing(settings):
    settings.GEMINI_API_KEY = ""
    settings.FIRECRAWL_API_KEY = "fake"

    fc_pois = [{"name": "POI", "type": "attraction"}]

    with patch.object(
        FirecrawlIngestionService, "_search_urls", return_value=["https://x"],
    ), patch.object(
        FirecrawlIngestionService,
        "_aggregate_payloads",
        return_value=_firecrawl_aggregated("Resumo", fc_pois),
    ), patch(
        "apps.destinations.services.GeminiDestinationEnricher",
    ) as enricher_cls:
        destination = DestinationDiscoveryService().discover(
            query="X", country="", city="", actor=None,
        )

    enricher_cls.assert_not_called()
    sources = destination.metadata.get("sources") or {}
    assert sources == {"firecrawl": True, "gemini": False}
```

- [ ] **Step 2: Rodar (devem falhar com ModuleNotFoundError)**

```bash
.venv/bin/python -m pytest tests/test_destination_discovery.py -v
```

- [ ] **Step 3: Implementar `services.py`**

Criar `backend/apps/destinations/services.py`:

```python
"""Orquestra Firecrawl + Gemini para descoberta paralela de destino."""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from django.conf import settings
from django.db import transaction
from django.utils.text import slugify

from apps.ai.enrichers.base import EnrichmentResult
from apps.ai.enrichers.destination_gemini import GeminiDestinationEnricher
from apps.integrations.services import (
    AggregatedExtraction,
    FirecrawlError,
    FirecrawlIngestionService,
)

from .models import Destination


logger = logging.getLogger(__name__)


class DestinationDiscoveryService:
    def __init__(self) -> None:
        self._firecrawl = FirecrawlIngestionService()

    def discover(
        self,
        *,
        query: str,
        country: str = "",
        city: str = "",
        actor=None,
    ) -> Destination | None:
        slug = slugify(query)
        if not slug:
            return None

        if self._firecrawl._is_recently_failed(slug):
            logger.info(
                "Pulando discovery para slug=%s (cache negativo, ttl=%ss)",
                slug, settings.FIRECRAWL_DISCOVERY_FAILURE_TTL,
            )
            return None

        firecrawl_result, gemini_result = self._run_parallel(query, country, city)

        if firecrawl_result is None and not gemini_result.has_meaningful_data():
            logger.info("Discovery sem dados uteis para slug=%s", slug)
            self._firecrawl._mark_recently_failed(slug)
            return None

        merged = self._merge(firecrawl_result, gemini_result, query=query, country=country, city=city)
        if not merged["has_data"]:
            self._firecrawl._mark_recently_failed(slug)
            return None

        return self._persist(slug=slug, merged=merged, actor=actor)

    def _run_parallel(
        self, query: str, country: str, city: str,
    ) -> tuple[AggregatedExtraction | None, EnrichmentResult]:
        with ThreadPoolExecutor(max_workers=2) as pool:
            fc_future = pool.submit(self._run_firecrawl, query, country, city)
            g_future = pool.submit(self._run_gemini, query, country, city)
            return fc_future.result(), g_future.result()

    def _run_firecrawl(self, query: str, country: str, city: str) -> AggregatedExtraction | None:
        try:
            urls = self._firecrawl._search_urls(query, country=country)
        except FirecrawlError:
            logger.exception("Firecrawl search falhou para query=%s", query)
            urls = []

        wiki_fallback = self._firecrawl._wikipedia_fallback_url(query)
        if not urls:
            urls = [wiki_fallback]

        try:
            return self._firecrawl._aggregate_payloads(urls)
        except FirecrawlError:
            if wiki_fallback in urls:
                logger.exception(
                    "Firecrawl falhou em todas as URLs (incluindo wiki) para query=%s", query,
                )
                return None
            logger.warning(
                "Firecrawl falhou em todas as %d URLs para query=%s, tentando wikipedia",
                len(urls), query,
            )
            try:
                return self._firecrawl._aggregate_payloads([wiki_fallback])
            except FirecrawlError:
                logger.exception("Fallback wikipedia tambem falhou para query=%s", query)
                return None

    def _run_gemini(self, query: str, country: str, city: str) -> EnrichmentResult:
        if not settings.GEMINI_API_KEY:
            return EnrichmentResult()
        try:
            return GeminiDestinationEnricher().enrich(query=query, country=country, city=city)
        except Exception:
            logger.exception("Gemini enricher falhou para query=%s", query)
            return EnrichmentResult()

    def _merge(
        self,
        firecrawl: AggregatedExtraction | None,
        gemini: EnrichmentResult,
        *,
        query: str,
        country: str,
        city: str,
    ) -> dict[str, Any]:
        fc_meta = firecrawl.extracted_meta if firecrawl else {}
        fc_pois = list(firecrawl.pois) if firecrawl else []
        fc_costs = firecrawl.costs if firecrawl else None
        fc_urls = list(firecrawl.source_urls) if firecrawl else []
        fc_failures = list(firecrawl.failures) if firecrawl else []

        def pick(key: str) -> str:
            return str(fc_meta.get(key) or getattr(gemini, key, "") or "")

        name = pick("name") or query.strip().title()
        country_val = pick("country") or country or "Desconhecido"
        city_val = pick("city") or city

        summary = pick("summary")
        best_season = pick("best_season")
        timezone = pick("timezone")
        hero = (fc_meta.get("hero_image_url") or "").strip()

        # Dedup POIs por slug — Firecrawl tem prioridade
        merged_pois = list(fc_pois)
        existing_slugs = {slugify(p.get("name") or "") for p in merged_pois}
        for poi in gemini.pois:
            poi_slug = slugify(poi.get("name") or "")
            if not poi_slug or poi_slug in existing_slugs:
                continue
            merged_pois.append(poi)
            existing_slugs.add(poi_slug)

        sources = {
            "firecrawl": firecrawl is not None,
            "gemini": gemini.has_meaningful_data(),
        }

        has_data = bool(summary) or bool(merged_pois)

        return {
            "name": name,
            "country": country_val,
            "city": city_val,
            "summary": summary,
            "best_season": best_season,
            "timezone": timezone,
            "hero_image_url": hero,
            "pois": merged_pois,
            "costs": fc_costs,
            "source_urls": fc_urls,
            "extracted_meta": fc_meta,
            "scrape_failures": fc_failures,
            "sources": sources,
            "gemini_model": gemini.metadata.get("model", ""),
            "has_data": has_data,
        }

    @transaction.atomic
    def _persist(self, *, slug: str, merged: dict[str, Any], actor) -> Destination:
        destination, created = Destination.objects.get_or_create(
            slug=slug,
            defaults={
                "name": merged["name"][:150],
                "country": merged["country"][:100],
                "city": (merged["city"] or "")[:100],
                "created_by": actor if actor and getattr(actor, "is_authenticated", False) else None,
            },
        )

        # Construir AggregatedExtraction-like payload pro _persist_extraction reutilizar logica
        aggregated = AggregatedExtraction(
            source_urls=merged["source_urls"],
            extracted_meta=merged["extracted_meta"],
            pois=merged["pois"],
            costs=merged["costs"],
            failures=merged["scrape_failures"],
        )
        self._firecrawl._persist_extraction(
            destination=destination,
            source_urls=merged["source_urls"],
            aggregated=aggregated,
        )

        # Pos-processar: garantir merge fields que vem so do Gemini
        updates: list[str] = []
        if merged["summary"] and not destination.summary:
            destination.summary = merged["summary"][:4000]
            updates.append("summary")
        if merged["best_season"] and not destination.best_season:
            destination.best_season = merged["best_season"][:120]
            updates.append("best_season")
        if merged["timezone"] and not destination.timezone:
            destination.timezone = merged["timezone"][:64]
            updates.append("timezone")

        existing_meta = destination.metadata if isinstance(destination.metadata, dict) else {}
        new_meta = {
            **existing_meta,
            "sources": merged["sources"],
        }
        if merged["gemini_model"]:
            new_meta["gemini_model"] = merged["gemini_model"]
        destination.metadata = new_meta
        updates.append("metadata")

        destination.save(update_fields=list(set(updates)))

        if created:
            self._firecrawl._promote_extracted_fields(destination, placeholder_name=merged["name"][:150])
        return destination
```

- [ ] **Step 4: Rodar (devem passar)**

```bash
.venv/bin/python -m pytest tests/test_destination_discovery.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/apps/destinations/services.py backend/tests/test_destination_discovery.py
git commit -m "feat(destinations): DestinationDiscoveryService paraleliza Firecrawl+Gemini"
```

---

## Task 9: Atualizar `DestinationViewSet.search`

**Files:**
- Modify: `backend/apps/destinations/views.py:32-69`
- Test: `backend/tests/test_destinations_search.py` (já existente — adicionar 1 teste)

- [ ] **Step 1: Adicionar teste pro novo fluxo**

Adicionar no final de `backend/tests/test_destinations_search.py`:

```python
def test_search_uses_discovery_service():
    """Confirma que view chama DestinationDiscoveryService, nao FirecrawlIngestionService direto."""
    from apps.destinations.models import Destination
    destination = Destination.objects.create(
        slug="bonito",
        name="Bonito",
        country="Brasil",
        summary="resumo via discovery",
    )

    with patch(
        "apps.destinations.views.DestinationDiscoveryService",
    ) as service_cls:
        service_cls.return_value.discover.return_value = destination
        client = APIClient()
        response = client.get("/api/destinations/search/?q=Bonito")

    service_cls.return_value.discover.assert_called_once()
    assert response.status_code == 200
    slugs = [item["slug"] for item in response.json()["data"]]
    assert "bonito" in slugs
```

- [ ] **Step 2: Rodar (deve falhar — view ainda usa FirecrawlIngestionService)**

```bash
.venv/bin/python -m pytest tests/test_destinations_search.py::test_search_uses_discovery_service -v
```

- [ ] **Step 3: Atualizar view**

Em `backend/apps/destinations/views.py`, substituir o import e o método `search`:

```python
import logging

from django.db.models import Q
from rest_framework import permissions
from rest_framework.decorators import action

from apps.audit.services import audit
from apps.common.mixins import StandardModelViewSet
from .models import Destination, PointOfInterest
from .serializers import DestinationSerializer, PointOfInterestSerializer
from .services import DestinationDiscoveryService


SEARCH_LIMIT = 20

logger = logging.getLogger(__name__)


class DestinationViewSet(StandardModelViewSet):
    queryset = Destination.objects.prefetch_related("pois", "pois__tags").select_related("cost_profile")
    serializer_class = DestinationSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ("country", "city")
    search_fields = ("name", "country", "city", "summary")
    ordering_fields = ("name", "average_rating", "created_at")

    def get_permissions(self):
        if self.action == "search":
            return [permissions.AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        q = request.query_params.get("q", "").strip()
        country = request.query_params.get("country", "").strip()
        city = request.query_params.get("city", "").strip()

        results = self._local_search(q=q, country=country, city=city)

        discovered = False
        if q and not results.exists():
            try:
                destination = DestinationDiscoveryService().discover(
                    query=q, country=country, city=city, actor=request.user,
                )
            except Exception:
                logger.exception("Falha na descoberta de destino para query=%s", q)
                destination = None

            if destination is not None:
                discovered = True
                audit(
                    "destination.discovered",
                    actor=request.user if request.user.is_authenticated else None,
                    target=destination,
                    metadata={
                        "query": q,
                        "country": country,
                        "city": city,
                        "sources": (destination.metadata or {}).get("sources") or {},
                    },
                )
                refreshed = list(self._local_search(q=q, country=country, city=city))
                if all(item.pk != destination.pk for item in refreshed):
                    enriched = self.get_queryset().filter(pk=destination.pk).first()
                    if enriched is not None:
                        refreshed.insert(0, enriched)
                results = refreshed

        data = self.get_serializer(results, many=True).data
        message = (
            "Resultados carregados (destino enriquecido)."
            if discovered
            else "Resultados da busca carregados com sucesso."
        )
        return self.success_response(data, message=message)

    def _local_search(self, *, q: str, country: str, city: str):
        queryset = self.get_queryset()
        if q:
            queryset = queryset.filter(
                Q(name__icontains=q)
                | Q(country__icontains=q)
                | Q(city__icontains=q)
                | Q(summary__icontains=q)
            )
        if country:
            queryset = queryset.filter(country__iexact=country)
        if city:
            queryset = queryset.filter(city__iexact=city)
        return queryset.order_by("-average_rating", "name")[:SEARCH_LIMIT]


class PointOfInterestViewSet(StandardModelViewSet):
    queryset = PointOfInterest.objects.select_related("destination").prefetch_related("tags")
    serializer_class = PointOfInterestSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    filterset_fields = ("destination", "poi_type", "tags__slug")
    search_fields = ("name", "summary", "address")
    ordering_fields = ("name", "rating", "estimated_visit_minutes")
```

- [ ] **Step 4: Atualizar testes existentes que mockam `FirecrawlIngestionService.discover_destination`**

No arquivo `backend/tests/test_destinations_search.py`, trocar os mocks de:
```python
"apps.destinations.views.FirecrawlIngestionService.discover_destination"
```
para:
```python
"apps.destinations.views.DestinationDiscoveryService.discover"
```

Os 3 testes existentes precisam dessa troca. Exemplo do primeiro:

```python
def test_search_returns_enriched_destination_even_when_local_filter_misses_accents():
    accented = _make_destination()
    with patch(
        "apps.destinations.views.DestinationDiscoveryService.discover",
        return_value=accented,
    ):
        client = APIClient()
        response = client.get("/api/destinations/search/?q=Sao Paulo")
    # resto igual ao atual
```

E o `test_search_skips_firecrawl_when_local_results_exist` vira `test_search_skips_discovery_when_local_results_exist` com mock análogo.

E `test_search_returns_empty_when_discover_returns_none` igual mas com novo path do mock.

- [ ] **Step 5: Rodar suite inteira (todos verdes)**

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected: todos passam (testes antigos + testes novos do design).

- [ ] **Step 6: Commit**

```bash
git add backend/apps/destinations/views.py backend/tests/test_destinations_search.py
git commit -m "feat(destinations): view search delega para DestinationDiscoveryService"
```

---

## Task 10: Atualizar `MODULES.md`

**Files:**
- Modify: `backend/MODULES.md`

- [ ] **Step 1: Atualizar seção `apps/ai`**

Em `backend/MODULES.md`, localizar a seção `apps/ai` (procure por "apps/ai" ou "PromptTemplate"). Substituir/expandir pelo texto:

```markdown
## `apps/ai` — Camada LLM

Provê o gerador de roteiro e o enricher de destinos via Gemini (Google).

### Estrutura
- `providers/base.py` — `LLMProvider` Protocol + exceções (`LLMProviderError`, `LLMTimeoutError`, `LLMAuthError`, `LLMQuotaError`, `LLMResponseError`).
- `providers/gemini.py` — `GeminiProvider` (cliente do Gemini via `google-generativeai`). Sem regras de negócio, só envia prompt e parseia retorno (JSON ou texto).
- `enrichers/base.py` — `BaseDestinationEnricher` + `EnrichmentResult` dataclass.
- `enrichers/destination_gemini.py` — `GeminiDestinationEnricher` com retry no `LLMResponseError` (1 tentativa extra).
- `generators/itinerary.py` — `GeminiItineraryGenerator(BaseItineraryGenerator)` consumido por `ItineraryGenerationService.run_job`.
- `services.py` — `get_generator()` lê `DEFAULT_LLM_PROVIDER`: `"gemini"` (com `GEMINI_API_KEY`) → `GeminiItineraryGenerator`; caso contrário → `MockItineraryGenerator`.

### Tuning (env)
| Variável | Default | Uso |
|---|---|---|
| `DEFAULT_LLM_PROVIDER` | `mock` | Setar `gemini` ativa o gerador real. |
| `GEMINI_API_KEY` | `""` | Chave do Gemini. |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Modelo. |
| `GEMINI_TIMEOUT` | `20` | Timeout (s) do enrichment de destino. |
| `GEMINI_ITINERARY_TIMEOUT` | `40` | Timeout (s) da geração de roteiro. |
```

- [ ] **Step 2: Atualizar seção `apps/destinations`**

Localizar a tabela de controllers da `apps/destinations` (procurar "DestinationViewSet.search"). Substituir a linha do `search` por:

```markdown
| DestinationViewSet.search | `/api/destinations/search/` | GET | Busca pública por destino (`?q=`, `?country=`, `?city=`) para a home (AllowAny). Em cache miss (`q` informado e zero resultados locais), aciona `DestinationDiscoveryService.discover` que **roda Firecrawl e Gemini em paralelo** via `ThreadPoolExecutor`, funde os resultados (Firecrawl factual vence em conflito; Gemini complementa lacunas) e persiste. Garante que o destino enriquecido sempre apareça no response mesmo se `_local_search` falhar por mismatch de acento. Audit event renomeado para `destination.discovered`. |
```

E logo após a tabela, adicionar:

```markdown
### `DestinationDiscoveryService` (`apps/destinations/services.py`)

Orquestra a descoberta de um destino combinando Firecrawl + Gemini. Em paralelo (`ThreadPoolExecutor`, `max_workers=2`):
- Firecrawl: `_search_urls` + `_aggregate_payloads` (com fallback Wikipedia).
- Gemini: `GeminiDestinationEnricher.enrich` (só se `GEMINI_API_KEY` setada).

Funde: Firecrawl > Gemini em todos os campos escalares (`summary`, `best_season`, `timezone`); `hero_image_url` e `costs` apenas Firecrawl; POIs unidos com dedup por slug (Firecrawl ganha em conflito); POIs novos do Gemini ficam com `metadata['source']='gemini'`. Persiste em transação. Marca cache negativo (`firecrawl:discover_failed:<slug>`) quando os dois falham.

`Destination.metadata` ganha:
- `sources`: `{firecrawl: bool, gemini: bool}`
- `gemini_model`: modelo usado (quando Gemini contribuiu)
- `source_urls`, `extracted` (do Firecrawl, inalterados)
- `scrape_failures` (do Firecrawl, inalterado)
```

- [ ] **Step 3: Commit**

```bash
git add backend/MODULES.md
git commit -m "docs: MODULES.md cobre apps/ai com Gemini e DestinationDiscoveryService"
```

---

## Task 11: Verificação end-to-end (manual, com Gemini real)

**Pré-condições:** `GEMINI_API_KEY` válida em `backend/.env`.

- [ ] **Step 1: Setar provider pra Gemini e rodar Django**

Em `backend/.env`, garantir:
```
DEFAULT_LLM_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...
```

Rodar servidor:

```bash
cd /home/davi-aldivino-marques/Documentos/www/viajero/backend
.venv/bin/python manage.py runserver
```

- [ ] **Step 2: Smoke test 1 — busca cidade desconhecida pro Firecrawl**

Em outro terminal:

```bash
curl -s "http://localhost:8000/api/destinations/search/?q=Itu" | head -100
```

Expected: `success: true`, `data` com ao menos 1 destino tendo `summary` populado. No log do Django, ver mensagens do Gemini sendo invocado.

- [ ] **Step 3: Smoke test 2 — geração de roteiro**

Pré-condição: ter um destino com POIs no banco (ex: rodar `seed_destinations` antes ou usar um destino existente).

```bash
# Pega um itinerário existente ou cria via API (precisa de token JWT)
# Substituir <token> e <id>
curl -s -X POST "http://localhost:8000/api/itineraries/<id>/generate/" \
  -H "Authorization: Bearer <token>"
```

Expected: response com itinerário gerado. No DB:

```bash
.venv/bin/python manage.py shell -c "
from apps.itineraries.models import Itinerary
it = Itinerary.objects.latest('updated_at')
print('status:', it.generation_status)
print('days:', it.days.count())
print('events com poi:', sum(d.events.exclude(poi__isnull=True).count() for d in it.days.all()))
"
```

Expected: `status: ready`, `days > 0`, eventos com `poi` setados.

- [ ] **Step 4: Rodar suite completa**

```bash
.venv/bin/python -m pytest tests/ -v
```

Expected: tudo verde.

- [ ] **Step 5: Commit final (se ainda houver mudanças, ex: docs ajustadas)**

```bash
git status
# se houver mudanças finais:
git add -p
git commit -m "chore: ajustes pos-smoke-test do Gemini"
```

---

## Notas de Execução

- **Sem chamadas reais ao Gemini nos testes**: tudo via `unittest.mock`. Suite continua < 1s.
- **TDD estrito**: cada step de implementação tem teste falhando antes.
- **Commits pequenos e frequentes**: 10 commits planejados (1 por task), cada um atômico e revisável.
- **Rollback fácil**: se algum task der ruim, `git revert <hash>` desfaz só aquele.
- **Não há mudança no contrato de URL** — a `insomnia-viajero.json` não precisa ser tocada.
- **Migrations**: nenhuma (não há mudança em models).
