# Integração Gemini — Geração de Roteiro + Fallback de Cidade

**Data:** 2026-05-20
**Status:** Aprovado para implementação
**Escopo:** Backend Django (`apps/ai`, `apps/destinations`, `apps/integrations`)

## Contexto

Hoje o backend tem infra de LLM pronta (`apps/ai`) mas o único gerador implementado é o `MockItineraryGenerator`. A descoberta de destino depende só do Firecrawl (`apps/integrations`), que falha com timeout em cidades pequenas, sites pesados ou quando a rede do Firecrawl está lenta.

Esta spec define como integrar o **Gemini (Google)** para:

1. **Geração real de roteiros** via `POST /api/itineraries/{id}/generate/` (substituindo o mock).
2. **Fallback complementar** para a descoberta de destinos — Firecrawl e Gemini rodam em paralelo e os resultados são fundidos.

## Decisões já fechadas

| Decisão | Escolha |
|---|---|
| Risco do fallback de cidade | **Moderado** — Gemini gera campos textuais + POIs textuais; sem `image_url` ou `hero_image_url`; metadata marca `source='gemini'` |
| Fluxo do roteiro | **Síncrono** (request HTTP espera o roteiro voltar pronto) |
| Trigger do fallback | **Complementar** — Firecrawl + Gemini rodam sempre, paralelos |
| Estruturação do código | **Refatorada** — providers/generators/enrichers separados; `DestinationDiscoveryService` novo orquestra |

## Arquitetura

### Árvore de arquivos (novos/modificados)

```
backend/
├── apps/
│   ├── ai/
│   │   ├── providers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              [NOVO] Protocol/ABC + exceções
│   │   │   └── gemini.py            [NOVO] GeminiProvider (google-generativeai)
│   │   ├── generators/
│   │   │   ├── __init__.py
│   │   │   └── itinerary.py         [NOVO] GeminiItineraryGenerator
│   │   ├── enrichers/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              [NOVO] BaseDestinationEnricher + EnrichmentResult
│   │   │   └── destination_gemini.py [NOVO] GeminiDestinationEnricher
│   │   └── services.py              [MOD] get_generator() ativa Gemini quando configurado
│   ├── destinations/
│   │   ├── services.py              [NOVO] DestinationDiscoveryService (paralelo)
│   │   └── views.py                 [MOD] search action delega pro DiscoveryService
│   └── integrations/
│       └── services.py              [INALTERADO em comportamento; mantém API pública]
├── tests/
│   ├── test_gemini_provider.py      [NOVO]
│   ├── test_gemini_enricher.py      [NOVO]
│   ├── test_gemini_itinerary.py     [NOVO]
│   └── test_destination_discovery.py [NOVO]
├── config/settings/base.py          [MOD] 4 envs novas
├── .env.example                     [MOD]
├── requirements.txt                 [MOD] adiciona google-generativeai
└── MODULES.md                       [MOD]
```

### Responsabilidades

**`GeminiProvider`** (`apps/ai/providers/gemini.py`)
- Cliente HTTP do Gemini via SDK `google-generativeai`.
- Métodos: `generate_json(prompt, schema, timeout) -> dict` e `generate_text(prompt, timeout) -> str`.
- Não conhece regras de negócio. Apenas envia prompt e devolve resposta parseada.
- Configuração: `GEMINI_API_KEY`, `GEMINI_MODEL` lidos de `settings`.
- Erros HTTP/parsing → `LLMProviderError` e subclasses.

**`BaseDestinationEnricher`** + **`GeminiDestinationEnricher`** (`apps/ai/enrichers/`)
- Interface análoga ao `BaseItineraryGenerator`.
- Método `enrich(query, country, city) -> EnrichmentResult` (dataclass).
- `EnrichmentResult`: `summary`, `best_season`, `timezone`, `pois` (lista de dicts textuais), `metadata`, `failures`.
- Não persiste; só prepara dados.

**`GeminiItineraryGenerator`** (`apps/ai/generators/itinerary.py`)
- Herda `BaseItineraryGenerator`.
- `generate(itinerary, profile, preferences, pois, prompt_template) -> dict` — mesmo contrato do mock atual.
- Internamente: monta prompt → `provider.generate_json(prompt, schema)` → valida → ajusta `poi_id`s contra DB → devolve dict.

**`DestinationDiscoveryService`** (`apps/destinations/services.py` — novo arquivo)
- `discover(query, country, city, actor) -> Destination | None`.
- Orquestra `FirecrawlIngestionService._aggregate_payloads(...)` e `GeminiDestinationEnricher.enrich(...)` via `concurrent.futures.ThreadPoolExecutor(max_workers=2)`.
- Funde os resultados (regras detalhadas abaixo).
- Persiste em `@transaction.atomic` somente se `has_meaningful_data()`.
- Mantém o cache negativo. A key permanece `firecrawl:discover_failed:<slug>` (por compatibilidade com código atual e testes), mas semanticamente passa a significar "discovery completa falhou" — ou seja, **Firecrawl E Gemini** ambos falharam. Marcação só ocorre quando o merged result não tem dados úteis.

**`apps/integrations/services.FirecrawlIngestionService`**
- Permanece tal qual está hoje em termos de API pública.
- O método `discover_destination` continua existindo (consumido pela `FirecrawlIngestionView` admin) mas a view pública passa a usar o `DestinationDiscoveryService`.

## Fluxos

### Busca de destino

```
GET /api/destinations/search/?q=Limeira
        │
        ▼
view.search → _local_search → tem resultado? ── sim ──► retorna direto (sem LLM)
        │
        não
        ▼
DestinationDiscoveryService.discover(query, country, city, actor)
        │
        ├─ ThreadPoolExecutor(max_workers=2)
        │       ├─ Future A: Firecrawl._search_urls + _aggregate_payloads
        │       │            (raise FirecrawlError → captura como None)
        │       └─ Future B: GeminiDestinationEnricher.enrich
        │                    (raise LLMProviderError → captura como None)
        │
        ▼
_merge(firecrawl, gemini) — regras de fusão (próxima seção)
        │
        ▼
has_meaningful_data()? ── não ──► return None + cache negativo
        │
        sim
        ▼
@transaction.atomic:
   destination, created = Destination.objects.get_or_create(slug=...)
   _persist_extraction(destination, merged)
   _promote_extracted_fields(...)
        │
        ▼
view retorna destination (garantindo que apareça no response)
```

#### Regras de fusão

| Campo | Resolução |
|---|---|
| `name` | Firecrawl > Gemini > placeholder (query title-cased) |
| `country` | Firecrawl > Gemini > placeholder ("Desconhecido") |
| `city` | Firecrawl > Gemini > input do request |
| `summary` | Firecrawl > Gemini |
| `best_season` | Firecrawl > Gemini |
| `timezone` | Firecrawl > Gemini |
| `hero_image_url` | **Firecrawl somente** (Gemini não fornece) |
| `costs` (low/mid/high) | **Firecrawl somente** (Gemini não fornece) |
| `pois` | União, dedup por `slug(name)`. POIs do Firecrawl ficam intactos. POIs do Gemini que casam por slug com algum do Firecrawl são descartados. POIs novos do Gemini entram com `metadata={"source": "gemini"}`. |
| `metadata.sources` | `{"firecrawl": bool, "gemini": bool}` |
| `metadata.source_urls` | URLs do Firecrawl (se houver) |
| `metadata.gemini_model` | `GEMINI_MODEL` usado (se Gemini contribuiu) |

`has_meaningful_data()` retorna `True` se houver `summary` (de qualquer fonte) ou ≥ 1 POI (de qualquer fonte).

### Geração de roteiro

```
POST /api/itineraries/{id}/generate/
        │
        ▼
ItineraryViewSet.generate → ItineraryGenerationService.create_job → run_job
        │
        ▼
get_generator() lê settings.DEFAULT_LLM_PROVIDER
        │
        ├─ "gemini" + GEMINI_API_KEY ──► GeminiItineraryGenerator
        └─ caso contrário             ──► MockItineraryGenerator
        │
        ▼
generator.generate(itinerary, profile, preferences, pois, template) → dict
        │
        ▼
run_job persiste: Itinerary.title/summary/budget; ItineraryDay + ItineraryDailyEvent
        (mesma lógica de hoje, sem mudança)
```

## Contratos JSON

### Enrichment de destino — schema de saída esperado

```json
{
  "type": "object",
  "properties": {
    "name":         { "type": "string" },
    "country":      { "type": "string" },
    "city":         { "type": "string" },
    "summary":      { "type": "string", "description": "2-3 paragrafos sobre o destino" },
    "best_season":  { "type": "string" },
    "timezone":     { "type": "string", "description": "ex: America/Sao_Paulo" },
    "pois": {
      "type": "array",
      "maxItems": 10,
      "items": {
        "type": "object",
        "properties": {
          "name":    { "type": "string" },
          "type":    { "type": "string", "enum": ["attraction","restaurant","activity","lodging"] },
          "summary": { "type": "string" },
          "tags":    { "type": "array", "items": {"type":"string"} }
        },
        "required": ["name", "type"]
      }
    }
  }
}
```

Sem `image_url` e sem `hero_image_url` — nível Moderado.

### Geração de roteiro — schema de saída esperado

```json
{
  "type": "object",
  "properties": {
    "title":          { "type": "string" },
    "summary":        { "type": "string" },
    "estimated_cost": { "type": "string", "description": "decimal como string" },
    "currency_code":  { "type": "string" },
    "days": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "properties": {
          "title":   { "type": "string" },
          "summary": { "type": "string" },
          "events": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "poi_id":         { "type": ["integer", "null"] },
                "title":          { "type": "string" },
                "description":    { "type": "string" },
                "start_time":     { "type": "string", "description": "HH:MM, opcional" },
                "end_time":       { "type": "string" },
                "estimated_cost": { "type": "string" },
                "order_index":    { "type": "integer" }
              },
              "required": ["title", "description", "order_index"]
            }
          }
        },
        "required": ["title", "events"]
      }
    }
  },
  "required": ["title", "days"]
}
```

`poi_id` é validado contra DB: existe e pertence ao mesmo destino → mantém FK; caso contrário → evento freestyle (`poi=None`), warning log.

## Settings novas

| Variável | Default | Uso |
|---|---|---|
| `GEMINI_API_KEY` | `""` | Chave do Gemini. Se vazia, `GeminiProvider` levanta `LLMAuthError` quando usado. |
| `GEMINI_MODEL` | `"gemini-2.0-flash"` | Modelo padrão. |
| `GEMINI_TIMEOUT` | `20` | Timeout (s) do enrichment de destino. |
| `GEMINI_ITINERARY_TIMEOUT` | `40` | Timeout (s) da geração de roteiro. |
| `DEFAULT_LLM_PROVIDER` | (existente) `"mock"` | Setar pra `"gemini"` para ativar o gerador real. |

`LLM_API_KEY` existente fica desativado em favor de `GEMINI_API_KEY` (mais explícito, prepara terreno pra outros providers).

## Error handling

### Exceções

```python
# apps/ai/providers/base.py
class LLMProviderError(Exception): pass
class LLMTimeoutError(LLMProviderError): pass
class LLMAuthError(LLMProviderError): pass
class LLMQuotaError(LLMProviderError): pass
class LLMResponseError(LLMProviderError): pass  # JSON inválido ou schema mismatch
```

### Comportamento por ponto de falha

| Falha | Geração de roteiro | Fallback de cidade |
|---|---|---|
| `LLMTimeoutError` | `LLMJob.status='failed'`, log, view retorna HTTP 503 com mensagem | Discovery loga warning; Gemini "não rodou"; segue só com Firecrawl |
| `LLMAuthError` | `LLMJob.status='failed'`, `logger.exception`, HTTP 500 | Mesmo padrão; segue só com Firecrawl |
| `LLMQuotaError` | `LLMJob.status='failed'`, HTTP 503 com mensagem indicando quota | Mesmo padrão |
| `LLMResponseError` | 1 retry com prompt reforçado ("responda EXATAMENTE no schema"). 2ª falha → `failed` | Mesma estratégia, 1 retry |
| Gemini OK mas dados vazios | `LLMJob.status='failed'` com motivo `empty_response` | Contribui nada; segue só com Firecrawl |
| Firecrawl falha + Gemini falha (na discovery) | n/a | `return None`, cache negativo (`FIRECRAWL_DISCOVERY_FAILURE_TTL`) |

### Timeout total

- Discovery: `max(t_firecrawl, t_gemini)` por rodar em paralelo. Pior caso ≈ Firecrawl (que pode chegar a ~45s com fallback Wikipedia). Para garantir <30s, ajustar `FIRECRAWL_SCRAPE_TIMEOUT` no env.
- Itinerary: roda single-shot Gemini. `GEMINI_ITINERARY_TIMEOUT=40` deve cobrir roteiros de até 14 dias com o `gemini-2.0-flash`.

## Testing

| Teste | Tipo | Como |
|---|---|---|
| `GeminiProvider.generate_json` | unit | Mock `google.generativeai.GenerativeModel.generate_content`; valida parsing e exceções |
| `GeminiDestinationEnricher.enrich` | unit | Mock provider; valida shape do `EnrichmentResult`; tolera JSON parcial |
| `GeminiItineraryGenerator.generate` | unit | Mock provider; valida ordem dos eventos, validação de `poi_id`, retry no schema mismatch |
| `DestinationDiscoveryService.discover` | integration | Mocks Firecrawl + Gemini com fakes — paralelo, fusão, ambos falhando, um falhando |
| `View search` end-to-end | integration | Mocks Firecrawl e Gemini — confirma merge correto e que a resposta contém o destino |
| `View generate itinerary` | integration | Mock Gemini — dispara endpoint, verifica `Itinerary.generation_status='ready'`, dias e FKs de POI |

Não há chamadas reais ao Gemini em CI — todos mockados. Suite continua < 1 segundo.

## Dependências

- `google-generativeai>=0.8.0,<0.9.0` em `requirements.txt`.

## Documentação a atualizar

- `MODULES.md` — seção `apps/ai` ganha subseção sobre o provider Gemini, e `apps/destinations` ganha menção ao `DestinationDiscoveryService`.
- `.env.example` — adiciona as 4 envs.
- `insomnia-viajero.json` — não muda (rotas existentes mantêm contrato).

## Itens fora de escopo (YAGNI)

- Streaming de tokens (SSE).
- Geração assíncrona via Celery.
- Cache positivo de respostas do Gemini (chave por hash de prompt).
- Provider OpenAI/Anthropic (estrutura permite adicionar, mas não implementamos agora).
- Retry com backoff exponencial em `LLMTimeoutError` (só retry em `LLMResponseError`).
- Validação semântica de POIs gerados pelo Gemini (verificar se o lugar realmente existe via outra fonte).
- UI/frontend mudanças — fora de escopo deste backend spec.

## Critérios de aceite

1. `POST /api/itineraries/{id}/generate/` com `DEFAULT_LLM_PROVIDER=gemini` retorna um roteiro real gerado pelo Gemini, com `Itinerary.generation_status='ready'`, dias e eventos persistidos, e ao menos 50% dos eventos referenciando `poi_id` válido (assumindo o destino ter ≥ 5 POIs no DB).
2. `GET /api/destinations/search/?q=Limeira` quando o Firecrawl falha em todas as fontes mas o Gemini responde com sucesso, cria/retorna o `Destination` com `metadata.sources={firecrawl: false, gemini: true}`, `summary` populado, e POIs do Gemini com `metadata.source='gemini'`.
3. Quando Firecrawl traz `summary` e POIs e Gemini também traz POIs, o response contém POIs do Firecrawl + POIs do Gemini sem duplicatas (dedup por slug). `metadata.sources={firecrawl: true, gemini: true}`.
4. Falha completa (Firecrawl + Gemini ambos None) → discovery retorna `None`, slug entra no cache negativo, view retorna lista vazia com mensagem genérica.
5. Suite de testes (incluindo testes novos) passa sem chamadas reais ao Gemini.
