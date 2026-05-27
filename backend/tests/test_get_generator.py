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
    settings.GROQ_API_KEY = ""
    assert isinstance(get_generator(), MockItineraryGenerator)


def test_get_generator_returns_groq_when_configured(settings):
    settings.DEFAULT_LLM_PROVIDER = "groq"
    settings.GROQ_API_KEY = "fake"
    from apps.ai.generators.itinerary_groq import GroqItineraryGenerator
    assert isinstance(get_generator(), GroqItineraryGenerator)


def test_get_generator_falls_back_to_groq_when_gemini_key_missing(settings):
    settings.DEFAULT_LLM_PROVIDER = "gemini"
    settings.GEMINI_API_KEY = ""
    settings.GROQ_API_KEY = "fake"
    from apps.ai.generators.itinerary_groq import GroqItineraryGenerator
    assert isinstance(get_generator(), GroqItineraryGenerator)
