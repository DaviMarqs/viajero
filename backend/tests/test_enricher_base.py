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
